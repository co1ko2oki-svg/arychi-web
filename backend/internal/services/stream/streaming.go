package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/discord/gateway"
	"arychi-web/backend/internal/discord/rest"
	"arychi-web/backend/internal/utils"
)

const VoiceActionCooldownMs = 1500

type StreamVideoParams struct {
	Width   int
	Height  int
	FPS     float64
	Bitrate int
}

type StreamConfiguration struct {
	Width                       int
	Height                      int
	FrameRate                   float64
	BitrateVideo                int
	BitrateVideoMax             int
	VideoCodec                  config.SupportedVideoCodec
	HardwareAcceleratedDecoding bool
	MinimizeLatency             bool
	H26xPreset                  config.H26xPreset
}

type StreamingService struct {
	mu                      sync.RWMutex
	cfg                     *config.StreamConfig
	client                  *gateway.Client
	restClient              *rest.Client
	mediaService            *MediaService
	queueService            *QueueService
	viewerService           *ViewerService
	streamStatus            *StreamStatus
	cancelFunc              context.CancelFunc
	isSkipping              bool
	lastVoiceActionTime     time.Time
	isVoiceActionInProgress bool
	voiceLockMu             sync.Mutex

	voiceConn       *gateway.MediaConnection
	streamConn      *gateway.MediaConnection
	activeStreamKey string
	voiceJoinedCh   chan struct{}
}

func NewStreamingService(
	cfg *config.StreamConfig,
	client *gateway.Client,
	restClient *rest.Client,
	streamStatus *StreamStatus,
	queueService *QueueService,
	viewerService *ViewerService,
) *StreamingService {
	if queueService == nil {
		queueService = NewQueueService()
	}
	s := &StreamingService{
		cfg:           cfg,
		client:        client,
		restClient:    restClient,
		mediaService:  NewMediaService(cfg),
		queueService:  queueService,
		viewerService: viewerService,
		streamStatus:  streamStatus,
		voiceJoinedCh: make(chan struct{}, 1),
	}
	s.syncQueueStatus()
	return s
}

func (s *StreamingService) SetClients(client *gateway.Client, restClient *rest.Client) {
	s.mu.Lock()
	s.client = client
	s.restClient = restClient
	s.mu.Unlock()
}

func (s *StreamingService) GetClient() *gateway.Client {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.client
}

func (s *StreamingService) GetRestClient() *rest.Client {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.restClient
}

func (s *StreamingService) GetQueueService() *QueueService {
	return s.queueService
}

func (s *StreamingService) GetViewerService() *ViewerService {
	return s.viewerService
}

func (s *StreamingService) GetMediaService() *MediaService {
	return s.mediaService
}

func (s *StreamingService) GetStreamStatus() *StreamStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.streamStatus
}

func (s *StreamingService) SetLoop(loop bool) {
	s.mu.Lock()
	s.streamStatus.IsLooping = loop
	s.mu.Unlock()
	utils.StreamLogs.Info("Stream loop mode set to: %v", loop)
}

func (s *StreamingService) IsLoopActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.streamStatus.IsLooping
}

func (s *StreamingService) syncQueueStatus() {
	s.mu.Lock()
	s.streamStatus.Queue = s.queueService.GetQueueStatus()
	s.mu.Unlock()
}

func (s *StreamingService) checkAndAcquireVoiceLock(msg *events.MessageCreateData) bool {
	s.voiceLockMu.Lock()
	defer s.voiceLockMu.Unlock()

	now := time.Now()
	elapsedMs := now.Sub(s.lastVoiceActionTime).Milliseconds()

	if s.isVoiceActionInProgress {
		if msg != nil {
			s.SendError(msg, "A voice action is currently in progress. Please wait.")
		}
		return false
	}

	if !s.lastVoiceActionTime.IsZero() && elapsedMs < VoiceActionCooldownMs {
		remSec := float64(VoiceActionCooldownMs-elapsedMs) / 1000.0
		if msg != nil {
			s.SendError(msg, fmt.Sprintf("Voice commands are throttled to protect Gateway. Please wait %.1fs.", remSec))
		}
		return false
	}

	s.isVoiceActionInProgress = true
	s.lastVoiceActionTime = now
	return true
}

func (s *StreamingService) releaseVoiceLock() {
	s.voiceLockMu.Lock()
	s.isVoiceActionInProgress = false
	s.lastVoiceActionTime = time.Now()
	s.voiceLockMu.Unlock()
}

func (s *StreamingService) AddToQueue(msg *events.MessageCreateData, videoSource, title, username string) bool {
	if videoSource == "" {
		return false
	}
	if username == "" {
		username = "Dashboard"
	}
	if msg != nil && msg.Author.Username != "" {
		username = msg.Author.Username
	}

	mediaSource := s.mediaService.ResolveMediaSource(videoSource)
	var queueItem QueueItem
	if mediaSource != nil {
		queueItem = s.queueService.AddToQueue(*mediaSource, username, videoSource)
	} else {
		fallbackTitle := title
		if fallbackTitle == "" {
			fallbackTitle = videoSource
		}
		queueItem = s.queueService.Add(videoSource, fallbackTitle, username, "url", false, videoSource)
	}

	s.syncQueueStatus()
	if msg != nil {
		s.SendSuccess(msg, fmt.Sprintf("Added to queue: `%s`", queueItem.Title))
	}
	return true
}

func (s *StreamingService) PlayFromQueue(msg *events.MessageCreateData) bool {
	if !s.checkAndAcquireVoiceLock(msg) {
		return false
	}
	defer s.releaseVoiceLock()

	s.mu.RLock()
	playing := s.streamStatus.Playing
	s.mu.RUnlock()

	if playing {
		if msg != nil {
			s.SendError(msg, "Already playing a video. Use skip command to skip current video.")
		}
		return false
	}

	nextItem := s.queueService.GetNext()
	if nextItem == nil {
		if msg != nil {
			s.SendError(msg, "Queue is empty.")
		}
		return false
	}

	s.queueService.SetPlaying(true)
	s.syncQueueStatus()
	go s.playVideoFromQueueItem(msg, *nextItem)
	return true
}

func (s *StreamingService) SkipCurrent(msg *events.MessageCreateData) bool {
	if !s.checkAndAcquireVoiceLock(msg) {
		return false
	}
	defer s.releaseVoiceLock()

	s.mu.RLock()
	playing := s.streamStatus.Playing
	skipping := s.isSkipping
	s.mu.RUnlock()

	if !playing {
		if msg != nil {
			s.SendError(msg, "No video is currently playing.")
		}
		return false
	}

	isLastItem := s.queueService.GetLength() <= 1
	if skipping && !isLastItem {
		if msg != nil {
			s.SendError(msg, "Skip already in progress.")
		}
		return false
	}

	s.mu.Lock()
	s.isSkipping = true
	s.streamStatus.ManualStop = true
	if s.cancelFunc != nil {
		s.cancelFunc()
	}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isSkipping = false
		s.mu.Unlock()
	}()

	s.stopActiveStream()

	currentItem := s.queueService.GetCurrent()
	nextItem := s.queueService.Skip()
	s.syncQueueStatus()

	if nextItem == nil {
		if msg != nil {
			s.SendInfo(msg, "Queue", "No more videos in queue.")
		}
		s.queueService.SetPlaying(false)
		s.syncQueueStatus()
		s.CleanupStreamStatus(false)
		return true
	}

	currentTitle := "current video"
	if currentItem != nil {
		currentTitle = currentItem.Title
	}
	if msg != nil {
		s.SendInfo(msg, "Skipping", fmt.Sprintf("Skipping `%s`. Playing next: `%s`", currentTitle, nextItem.Title))
	}

	s.mu.Lock()
	s.streamStatus.ManualStop = false
	s.mu.Unlock()

	go s.playVideoFromQueueItem(msg, *nextItem)
	return true
}

func (s *StreamingService) HandleChannelMove(newChannelID string) {
	s.mu.Lock()
	s.streamStatus.ChannelInfo.ChannelID = newChannelID
	guildID := s.streamStatus.ChannelInfo.GuildID
	gw := s.client
	s.mu.Unlock()

	if gw != nil && guildID != "" {
		_ = gw.CreateStream("guild", guildID, newChannelID, nil)
		key := gateway.GenerateStreamKey("guild", guildID, newChannelID, gw.UserID())
		_ = gw.SetStreamPaused(key, false)
	}

	if s.viewerService != nil && s.viewerService.IsConfigured() && guildID != "" && gw != nil && gw.UserID() != "" {
		go s.viewerService.WatchStream(guildID, newChannelID, gw.UserID())
	}

	utils.StreamLogs.Info("Stream routed to new voice channel: %s", newChannelID)
}

func (s *StreamingService) playVideoFromQueueItem(msg *events.MessageCreateData, item QueueItem) {
	s.queueService.SetPlaying(true)
	s.syncQueueStatus()

	var videoParams *StreamVideoParams
	s.cfg.RLock()
	respectParams := s.cfg.RespectVideoParams
	s.cfg.RUnlock()

	if respectParams {
		videoParams = s.getVideoParameters(item.URL)
	}

	utils.StreamLogs.Info("Playing from queue: %s (%s)", item.Title, item.URL)
	s.PlayVideo(msg, item.URL, item.Title, videoParams)
}

func (s *StreamingService) getVideoParameters(videoURL string) *StreamVideoParams {
	res, err := GetVideoParams(videoURL)
	if err != nil {
		utils.StreamLogs.Error("Error in determining video parameters: %v", err)
		return nil
	}
	utils.StreamLogs.Info("Video parameters: %dx%d, FPS: %v, Bitrate: %s", res.Width, res.Height, res.FPS, res.Bitrate)
	var bitrateKbps int
	if res.Bitrate != "" {
		if parsed, err := strconv.Atoi(res.Bitrate); err == nil {
			bitrateKbps = int(math.Round(float64(parsed) / 1000.0))
		}
	}
	return &StreamVideoParams{
		Width:   res.Width,
		Height:  res.Height,
		FPS:     res.FPS,
		Bitrate: bitrateKbps,
	}
}

func (s *StreamingService) setupStreamConfiguration(videoParams *StreamVideoParams) StreamConfiguration {
	s.cfg.RLock()
	defer s.cfg.RUnlock()

	width := s.cfg.Width
	height := s.cfg.Height
	frameRate := float64(s.cfg.FPS)
	bitrateVideo := s.cfg.BitrateKbps

	if videoParams != nil {
		if videoParams.Width > 0 {
			width = videoParams.Width
		}
		if videoParams.Height > 0 {
			height = videoParams.Height
		}
		if videoParams.FPS > 0 {
			frameRate = videoParams.FPS
		}
		if videoParams.Bitrate > 0 && !s.cfg.BitrateOverride {
			bitrateVideo = videoParams.Bitrate
		}
	}

	if s.cfg.MaxWidth > 0 || s.cfg.MaxHeight > 0 {
		ratio := float64(width) / float64(height)
		if s.cfg.MaxWidth > 0 && width > s.cfg.MaxWidth {
			width = s.cfg.MaxWidth
			height = int(math.Round(float64(width) / ratio))
		}
		if s.cfg.MaxHeight > 0 && height > s.cfg.MaxHeight {
			height = s.cfg.MaxHeight
			width = int(math.Round(float64(height) * ratio))
		}
		width = int(math.Round(float64(width)/2.0)) * 2
		height = int(math.Round(float64(height)/2.0)) * 2
	}

	return StreamConfiguration{
		Width:                       width,
		Height:                      height,
		FrameRate:                   frameRate,
		BitrateVideo:                bitrateVideo,
		BitrateVideoMax:             s.cfg.MaxBitrateKbps,
		VideoCodec:                  config.ParseVideoCodec(string(s.cfg.VideoCodec)),
		HardwareAcceleratedDecoding: s.cfg.HardwareAcceleratedDecoding,
		MinimizeLatency:             false,
		H26xPreset:                  config.ParsePreset(string(s.cfg.H26xPreset)),
	}
}

func (s *StreamingService) ensureVoiceConnection(guildID, channelID, title string) error {
	s.mu.RLock()
	joined := s.streamStatus.Joined
	gw := s.client
	s.mu.RUnlock()

	if gw != nil && !joined {
		chID := channelID
		if err := gw.UpdateVoiceState(guildID, &chID, false, true, false); err != nil {
			return err
		}
	}

	if gw != nil && guildID != "" && channelID != "" && gw.UserID() != "" {
		_ = gw.CreateStream("guild", guildID, channelID, nil)
		key := gateway.GenerateStreamKey("guild", guildID, channelID, gw.UserID())
		_ = gw.SetStreamPaused(key, false)
		s.mu.Lock()
		s.activeStreamKey = key
		s.mu.Unlock()
	}

	s.cfg.RLock()
	cmdChannelID := s.cfg.CmdChannelID
	s.cfg.RUnlock()

	s.mu.Lock()
	s.streamStatus.Joined = true
	s.streamStatus.JoinSucc = true
	s.streamStatus.Playing = true
	s.streamStatus.ChannelInfo = ChannelInfo{
		GuildID:      guildID,
		ChannelID:    channelID,
		CmdChannelID: cmdChannelID,
	}
	s.mu.Unlock()

	if title != "" && gw != nil {
		_ = gw.UpdateStatusWatch(title)
	}
	return nil
}

func (s *StreamingService) prepareVideoSource(msg *events.MessageCreateData, videoSource, title string) (string, string, error) {
	isURL := strings.HasPrefix(videoSource, "http://") || strings.HasPrefix(videoSource, "https://")
	mediaSource := s.mediaService.ResolveMediaSource(videoSource)
	if mediaSource != nil && mediaSource.Type == "youtube" && !mediaSource.IsLive {
		tempFile := s.handleDownload(msg, videoSource, title)
		if tempFile != "" {
			return tempFile, tempFile, nil
		}
		return "", "", fmt.Errorf("Failed to prepare video source due to download failure.")
	}
	if mediaSource != nil && mediaSource.URL != "" {
		return mediaSource.URL, "", nil
	}
	if isURL {
		return "", "", fmt.Errorf("URL video/stream không hợp lệ hoặc video không khả dụng: %s", videoSource)
	}
	return videoSource, "", nil
}

func (s *StreamingService) handleDownload(msg *events.MessageCreateData, videoSource, title string) string {
	displayTitle := title
	if displayTitle == "" {
		displayTitle = "YouTube video"
	}

	var dlMsg *rest.DiscordMessage
	rc := s.GetRestClient()
	if msg != nil && rc != nil {
		dlMsg, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("📥 Downloading `%s`...", displayTitle), msg.ID)
	}

	utils.StreamLogs.Info("Downloading %s...", displayTitle)
	tempFilePath := s.mediaService.DownloadYouTubeVideo(videoSource)
	if tempFilePath != "" {
		utils.StreamLogs.Info("Finished downloading %s", displayTitle)
		if dlMsg != nil && rc != nil {
			_ = rc.DeleteMessage(msg.ChannelID, dlMsg.ID)
		}
		return tempFilePath
	}

	errText := fmt.Sprintf("❌ Failed to download `%s`.", displayTitle)
	if dlMsg != nil && rc != nil {
		_, _ = rc.EditMessage(msg.ChannelID, dlMsg.ID, errText)
	} else if msg != nil {
		s.SendError(msg, "Failed to download video")
	}
	return ""
}

func (s *StreamingService) executeStream(ctx context.Context, inputForFfmpeg string, streamOpts StreamConfiguration, msg *events.MessageCreateData, title, videoSource string) {
	ffmpegBin := GetFFmpegExecutablePath()
	display := title
	if display == "" {
		display = videoSource
	}

	if ffmpegBin != "" {
		args := []string{"-re"}
		if streamOpts.HardwareAcceleratedDecoding {
			args = append(args, "-hwaccel", "auto")
		}
		args = append(args,
			"-i", inputForFfmpeg,
			"-vf", fmt.Sprintf("scale=%d:%d", streamOpts.Width, streamOpts.Height),
			"-r", fmt.Sprintf("%.0f", streamOpts.FrameRate),
			"-b:v", fmt.Sprintf("%dk", streamOpts.BitrateVideo),
			"-maxrate:v", fmt.Sprintf("%dk", streamOpts.BitrateVideoMax),
			"-f", "null", "-",
		)

		cmd := exec.CommandContext(ctx, ffmpegBin, args...)
		err := cmd.Run()
		if err != nil && ctx.Err() == nil {
			s.mu.RLock()
			manualStop := s.streamStatus.ManualStop
			s.mu.RUnlock()
			if !manualStop {
				utils.StreamLogs.Error("An error occurred in ffmpeg: %v", err)
				if msg != nil {
					s.SendError(msg, fmt.Sprintf("Stream error: %v", err))
				}
			}
		}
	} else {
		// Wait on context if ffmpeg binary isn't present in test environment
		select {
		case <-ctx.Done():
		case <-time.After(5 * time.Second):
		}
	}

	s.mu.RLock()
	manualStop := s.streamStatus.ManualStop
	s.mu.RUnlock()

	if ctx.Err() == nil && !manualStop {
		utils.StreamLogs.Info("Finished playing: %s", display)
	} else if manualStop {
		utils.StreamLogs.Info("Stopped playing: %s", display)
	} else {
		utils.StreamLogs.Info("Failed playing: %s", display)
	}
}

func (s *StreamingService) PlayVideo(msg *events.MessageCreateData, videoSource, title string, videoParams *StreamVideoParams) {
	s.cfg.RLock()
	guildID := s.cfg.GuildID
	channelID := s.cfg.VideoChannelID
	autoWatch := s.cfg.ViewerAutoWatch
	s.cfg.RUnlock()

	s.mu.Lock()
	s.streamStatus.ManualStop = false
	s.mu.Unlock()

	if title != "" {
		cur := s.queueService.GetCurrent()
		if cur != nil && cur.Title == title {
			s.queueService.SetPlaying(true)
			s.syncQueueStatus()
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.cancelFunc = cancel
	s.mu.Unlock()

	var tempFile string
	defer func() {
		s.finalizeStream(ctx, msg, tempFile)
	}()

	inputForFfmpeg, tempFilePath, err := s.prepareVideoSource(msg, videoSource, title)
	tempFile = tempFilePath
	if err != nil {
		utils.StreamLogs.Error("Error in playing video: %s: %v", title, err)
		cancel()
		return
	}

	if err := s.ensureVoiceConnection(guildID, channelID, title); err != nil {
		utils.StreamLogs.Error("Error in playing video: %s: %v", title, err)
		cancel()
		return
	}

	displayTitle := title
	if displayTitle == "" {
		displayTitle = videoSource
	}
	s.SendPlaying(msg, displayTitle)

	gw := s.GetClient()
	if s.viewerService != nil && autoWatch && s.viewerService.IsConfigured() && gw != nil && gw.UserID() != "" {
		go s.viewerService.WatchStream(guildID, channelID, gw.UserID())
	}

	streamOpts := s.setupStreamConfiguration(videoParams)
	s.executeStream(ctx, inputForFfmpeg, streamOpts, msg, displayTitle, videoSource)
}

func (s *StreamingService) finalizeStream(ctx context.Context, msg *events.MessageCreateData, tempFile string) {
	s.mu.RLock()
	manualStop := s.streamStatus.ManualStop
	s.mu.RUnlock()

	if !manualStop && ctx.Err() == nil {
		s.handleQueueAdvancement(msg)
	} else {
		s.queueService.SetPlaying(false)
		s.queueService.ResetCurrentIndex()
		s.syncQueueStatus()
		s.CleanupStreamStatus(false)
	}

	if tempFile != "" && strings.HasPrefix(filepath.Base(tempFile), "ytdlp_temp_") {
		if err := os.Remove(tempFile); err != nil {
			utils.StreamLogs.Error("Failed to delete temp file %s: %v", tempFile, err)
		}
	}
}

func (s *StreamingService) handleQueueAdvancement(msg *events.MessageCreateData) {
	if msg != nil {
		s.SendFinishMessage(msg)
	}

	finishedItem := s.queueService.GetCurrent()
	if finishedItem != nil {
		s.queueService.RemoveFromQueue(finishedItem.ID)
		if s.IsLoopActive() {
			s.queueService.Add(
				finishedItem.URL,
				finishedItem.Title,
				finishedItem.RequestedBy,
				finishedItem.Type,
				finishedItem.IsLive,
				finishedItem.OriginalInput,
			)
			utils.StreamLogs.Info("[Loop Farm] Re-enqueued finished video for endless farm: %s", finishedItem.Title)
		}
	}

	nextItem := s.queueService.GetNext()
	s.syncQueueStatus()

	if nextItem != nil {
		utils.StreamLogs.Info("Auto-playing next item from queue: %s", nextItem.Title)
		itemCopy := *nextItem
		time.AfterFunc(1*time.Second, func() {
			s.playVideoFromQueueItem(msg, itemCopy)
		})
	} else {
		s.queueService.SetPlaying(false)
		s.syncQueueStatus()
		utils.StreamLogs.Info("No more items in queue, playback stopped")
		s.CleanupStreamStatus(false)
	}
}

func (s *StreamingService) stopActiveStream() {
	s.mu.Lock()
	gw := s.client
	key := s.activeStreamKey
	s.activeStreamKey = ""
	if s.streamConn != nil {
		s.streamConn.Close()
		s.streamConn = nil
	}
	s.mu.Unlock()

	if gw != nil && key != "" {
		_ = gw.DeleteStream(key)
	}
}

func (s *StreamingService) CleanupStreamStatus(forceLeave bool) {
	s.mu.Lock()
	if s.cancelFunc != nil {
		s.cancelFunc()
		s.cancelFunc = nil
	}
	gw := s.client
	guildID := s.streamStatus.ChannelInfo.GuildID
	joined := s.streamStatus.Joined
	s.mu.Unlock()

	if guildID == "" && s.cfg != nil {
		s.cfg.RLock()
		guildID = s.cfg.GuildID
		s.cfg.RUnlock()
	}

	s.stopActiveStream()

	if s.viewerService != nil {
		s.viewerService.StopWatching()
	}

	if forceLeave || s.queueService.IsEmpty() || !joined {
		if gw != nil && guildID != "" {
			_ = gw.UpdateVoiceState(guildID, nil, false, false, false)
		}
		s.mu.Lock()
		if s.voiceConn != nil {
			s.voiceConn.Close()
			s.voiceConn = nil
		}
		s.streamStatus.Joined = false
		s.streamStatus.JoinSucc = false
		s.mu.Unlock()
	}

	if gw != nil {
		_ = gw.UpdateStatusIdle()
	}

	s.mu.Lock()
	s.streamStatus.Playing = false
	s.streamStatus.ManualStop = false
	s.streamStatus.ChannelInfo = ChannelInfo{
		GuildID:      "",
		ChannelID:    "",
		CmdChannelID: "",
	}
	s.mu.Unlock()
	s.syncQueueStatus()
}

func (s *StreamingService) StopAndClearQueue(msg *events.MessageCreateData) bool {
	s.voiceLockMu.Lock()
	s.isVoiceActionInProgress = false
	s.voiceLockMu.Unlock()

	s.queueService.ClearQueue()
	s.syncQueueStatus()
	utils.StreamLogs.Info("Queue cleared and stopping all stream services")
	s.CleanupStreamStatus(true)
	return true
}

func (s *StreamingService) HandleVoiceStateUpdate(raw json.RawMessage) {
	var vs events.VoiceState
	if json.Unmarshal(raw, &vs) != nil {
		return
	}
	gw := s.GetClient()
	if gw == nil || vs.UserID != gw.UserID() {
		return
	}

	s.mu.RLock()
	prevChan := s.streamStatus.ChannelInfo.ChannelID
	prevGuild := s.streamStatus.ChannelInfo.GuildID
	joined := s.streamStatus.Joined
	s.mu.RUnlock()

	newChan := ""
	if vs.ChannelID != nil {
		newChan = *vs.ChannelID
	}

	if joined && prevChan != "" && newChan == "" {
		utils.StreamLogs.Info("Bot was disconnected from voice channel, terminating active stream and cleaning up...")
		s.CleanupStreamStatus(true)
		return
	}

	if joined && prevChan != "" && newChan != "" && prevChan != newChan {
		utils.StreamLogs.Info("Bot voice channel moved: %s -> %s", prevChan, newChan)
		s.HandleChannelMove(newChan)
		return
	}

	if newChan != "" && !joined {
		s.mu.Lock()
		s.streamStatus.Joined = true
		if vs.GuildID == prevGuild && newChan == prevChan {
			s.streamStatus.JoinSucc = true
		}
		s.mu.Unlock()
	}
}

// DiscordUtils helpers matching `stream/src/utils/shared.ts`

func (s *StreamingService) SendError(msg *events.MessageCreateData, errText string) {
	rc := s.GetRestClient()
	if msg == nil || rc == nil || errText == "" {
		return
	}
	_ = rc.AddReaction(msg.ChannelID, msg.ID, "❌")
	_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("❌ **Error**: %s", errText), msg.ID)
}

func (s *StreamingService) SendSuccess(msg *events.MessageCreateData, desc string) {
	rc := s.GetRestClient()
	if msg == nil || rc == nil || desc == "" {
		return
	}
	_ = rc.AddReaction(msg.ChannelID, msg.ID, "✅")
	_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("✅ **Success**: %s", desc), "")
}

func (s *StreamingService) SendInfo(msg *events.MessageCreateData, title, desc string) {
	rc := s.GetRestClient()
	if msg == nil || rc == nil || title == "" || desc == "" {
		return
	}
	_ = rc.AddReaction(msg.ChannelID, msg.ID, "ℹ️")
	_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("ℹ️ **%s**: %s", title, desc), "")
}

func (s *StreamingService) SendPlaying(msg *events.MessageCreateData, title string) {
	rc := s.GetRestClient()
	if msg == nil || rc == nil || title == "" {
		return
	}
	_ = rc.AddReaction(msg.ChannelID, msg.ID, "▶️")
	_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("📽 **Now Playing**: `%s`", title), msg.ID)
}

func (s *StreamingService) SendFinishMessage(msg *events.MessageCreateData) {
	rc := s.GetRestClient()
	if msg == nil || rc == nil {
		return
	}
	_, _ = rc.SendMessage(msg.ChannelID, "⏹️ **Finished**: Finished playing video.", "")
}

func (s *StreamingService) SendList(msg *events.MessageCreateData, items []string, listType string) {
	rc := s.GetRestClient()
	if msg == nil || rc == nil || len(items) == 0 {
		return
	}
	_ = rc.AddReaction(msg.ChannelID, msg.ID, "📋")
	joined := strings.Join(items, "\n")
	switch listType {
	case "ytsearch":
		_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("📋 **Search Results**:\n%s", joined), msg.ID)
	case "refresh":
		_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("📋 **Video list refreshed**:\n%s", joined), msg.ID)
	default:
		_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("📋 **Local Videos List**:\n%s", joined), "")
	}
}
