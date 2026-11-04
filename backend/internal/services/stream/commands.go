package stream

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/utils"
)

type CommandContext struct {
	Message          *events.MessageCreateData
	Args             []string
	Videos           *[]Video
	StreamStatus     *StreamStatus
	StreamingService *StreamingService
	Config           *config.StreamConfig
}

type Command struct {
	Name        string
	Description string
	Usage       string
	Aliases     []string
	Execute     func(ctx *CommandContext)
}

type CommandManager struct {
	mu       sync.RWMutex
	cfg      *config.StreamConfig
	commands map[string]*Command
	aliases  map[string]string
	order    []string
	videos   []Video
}

func NewCommandManager(cfg *config.StreamConfig, initialVideos []Video) *CommandManager {
	cm := &CommandManager{
		cfg:      cfg,
		commands: make(map[string]*Command),
		aliases:  make(map[string]string),
		videos:   initialVideos,
	}
	cm.registerCommands()
	return cm
}

func (cm *CommandManager) register(cmd *Command) {
	name := strings.ToLower(cmd.Name)
	cm.commands[name] = cmd
	cm.order = append(cm.order, name)
	for _, alias := range cmd.Aliases {
		cm.aliases[strings.ToLower(alias)] = name
	}
}

func (cm *CommandManager) GetCommand(name string) *Command {
	key := strings.ToLower(name)
	if cmd, ok := cm.commands[key]; ok {
		return cmd
	}
	if target, ok := cm.aliases[key]; ok {
		return cm.commands[target]
	}
	return nil
}

func (cm *CommandManager) GetCommandList() string {
	prefix := "!"
	if cm.cfg != nil {
		cm.cfg.RLock()
		if cm.cfg.Prefix != "" {
			prefix = cm.cfg.Prefix
		}
		cm.cfg.RUnlock()
	}

	var lines []string
	for _, name := range cm.order {
		cmd := cm.commands[name]
		lines = append(lines, fmt.Sprintf("**%s**: %s\nUsage: `%s%s`", cmd.Name, cmd.Description, prefix, cmd.Usage))
	}
	return strings.Join(lines, "\n")
}

func (cm *CommandManager) HandleMessageCreate(raw json.RawMessage, status *StreamStatus, svc *StreamingService) {
	var msg events.MessageCreateData
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	gw := svc.GetClient()
	botUserID := ""
	if gw != nil {
		botUserID = gw.UserID()
	}

	cm.cfg.RLock()
	prefix := cm.cfg.Prefix
	cmdChannelID := cm.cfg.CmdChannelID
	cm.cfg.RUnlock()

	if msg.Author.Bot || (botUserID != "" && msg.Author.ID == botUserID) || !strings.HasPrefix(msg.Content, prefix) {
		return
	}

	if cmdChannelID != "" && msg.ChannelID != cmdChannelID {
		return
	}

	trimmed := strings.TrimSpace(msg.Content[len(prefix):])
	if trimmed == "" {
		return
	}

	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return
	}

	cmdName := strings.ToLower(parts[0])
	args := parts[1:]

	cmd := cm.GetCommand(cmdName)
	if cmd == nil {
		rc := svc.GetRestClient()
		if rc != nil {
			_ = rc.AddReaction(msg.ChannelID, msg.ID, "❌")
			_, _ = rc.SendMessage(msg.ChannelID, fmt.Sprintf("❌ **Error**: Unknown command. Use `%shelp` to see available commands.", prefix), msg.ID)
		}
		return
	}

	cm.mu.Lock()
	ctx := &CommandContext{
		Message:          &msg,
		Args:             args,
		Videos:           &cm.videos,
		StreamStatus:     status,
		StreamingService: svc,
		Config:           cm.cfg,
	}
	cm.mu.Unlock()

	cmd.Execute(ctx)
}

func (cm *CommandManager) registerCommands() {
	// 1. config
	cm.register(&Command{
		Name:        "config",
		Description: "View or adjust bot configuration parameters (Admin only)",
		Usage:       "config [parameter] [value]",
		Aliases:     []string{"cfg", "set"},
		Execute:     cm.execConfig,
	})

	// 2. farm
	cm.register(&Command{
		Name:        "farm",
		Description: "Stream farming & badge watcher controls",
		Usage:       "farm [status|loop|watch|stop]",
		Aliases:     []string{"badge", "watcher"},
		Execute:     cm.execFarm,
	})

	// 3. help
	cm.register(&Command{
		Name:        "help",
		Description: "Show available commands",
		Usage:       "help",
		Execute:     cm.execHelp,
	})

	// 4. list
	cm.register(&Command{
		Name:        "list",
		Description: "Show available local videos",
		Usage:       "list",
		Execute:     cm.execList,
	})

	// 5. loop
	cm.register(&Command{
		Name:        "loop",
		Description: "Toggle endless stream loop mode for AFK farming",
		Usage:       "loop [on|off]",
		Aliases:     []string{"repeat"},
		Execute:     cm.execLoop,
	})

	// 6. ping
	cm.register(&Command{
		Name:        "ping",
		Description: "Check bot latency",
		Usage:       "ping",
		Execute:     cm.execPing,
	})

	// 7. play
	cm.register(&Command{
		Name:        "play",
		Description: "Play local video, URL, or search YouTube videos",
		Usage:       "play <video_name|url|search_query>",
		Execute:     cm.execPlay,
	})

	// 8. preview
	cm.register(&Command{
		Name:        "preview",
		Description: "Generate preview thumbnails for a video",
		Usage:       "preview <video_name>",
		Execute:     cm.execPreview,
	})

	// 9. queue
	cm.register(&Command{
		Name:        "queue",
		Description: "Display the current video queue",
		Usage:       "queue",
		Execute:     cm.execQueue,
	})

	// 10. skip
	cm.register(&Command{
		Name:        "skip",
		Description: "Skip the currently playing video",
		Usage:       "skip",
		Aliases:     []string{"next"},
		Execute:     cm.execSkip,
	})

	// 11. status
	cm.register(&Command{
		Name:        "status",
		Description: "Show current streaming status",
		Usage:       "status",
		Execute:     cm.execStatus,
	})

	// 12. stop
	cm.register(&Command{
		Name:        "stop",
		Description: "Stop current video playback and clear queue",
		Usage:       "stop",
		Aliases:     []string{"leave", "s"},
		Execute:     cm.execStop,
	})

	// 13. ytsearch
	cm.register(&Command{
		Name:        "ytsearch",
		Description: "Search for videos on YouTube",
		Usage:       "ytsearch <query>",
		Execute:     cm.execYtSearch,
	})

	utils.StreamLogs.Info("Loaded %d commands", len(cm.commands))
}

func (cm *CommandManager) execHelp(ctx *CommandContext) {
	rc := ctx.StreamingService.GetRestClient()
	if rc == nil {
		return
	}
	helpText := fmt.Sprintf("📽 **Available Commands**\n\n%s", cm.GetCommandList())
	_ = rc.AddReaction(ctx.Message.ChannelID, ctx.Message.ID, "📋")
	_, _ = rc.SendMessage(ctx.Message.ChannelID, helpText, ctx.Message.ID)
}

func (cm *CommandManager) execPing(ctx *CommandContext) {
	rc := ctx.StreamingService.GetRestClient()
	if rc == nil {
		return
	}
	start := time.Now()
	sent, err := rc.SendMessage(ctx.Message.ChannelID, "🏓 Pinging...", ctx.Message.ID)
	if err != nil || sent == nil {
		return
	}
	diffMs := time.Since(start).Milliseconds()
	_, _ = rc.EditMessage(ctx.Message.ChannelID, sent.ID, fmt.Sprintf("🏓 Pong! Latency: %dms", diffMs))
}

func (cm *CommandManager) execStatus(ctx *CommandContext) {
	ctx.StreamingService.mu.RLock()
	joined := ctx.StreamStatus.Joined
	playing := ctx.StreamStatus.Playing
	ctx.StreamingService.mu.RUnlock()

	ctx.StreamingService.SendInfo(
		ctx.Message,
		"Status",
		fmt.Sprintf("Joined: %v\nPlaying: %v", joined, playing),
	)
}

func (cm *CommandManager) refreshVideosList(videosDir string) []Video {
	entries, err := os.ReadDir(videosDir)
	if err != nil {
		return nil
	}
	var refreshed []Video
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		base := strings.TrimSuffix(name, filepath.Ext(name))
		refreshed = append(refreshed, Video{
			Name: base,
			Path: filepath.Join(videosDir, name),
		})
	}
	return refreshed
}

func (cm *CommandManager) execList(ctx *CommandContext) {
	ctx.Config.RLock()
	videosDir := ctx.Config.VideosDir
	ctx.Config.RUnlock()

	if info, err := os.Stat(videosDir); err != nil || !info.IsDir() {
		ctx.StreamingService.SendError(ctx.Message, "Videos directory does not exist.")
		return
	}

	refreshed := cm.refreshVideosList(videosDir)
	cm.mu.Lock()
	*ctx.Videos = refreshed
	cm.mu.Unlock()

	if len(refreshed) == 0 {
		ctx.StreamingService.SendError(ctx.Message, "No videos found.")
		return
	}

	items := []string{fmt.Sprintf("(%d videos found)", len(refreshed))}
	for i, v := range refreshed {
		items = append(items, fmt.Sprintf("%d. `%s`", i+1, v.Name))
	}
	ctx.StreamingService.SendList(ctx.Message, items, "")
}

func (cm *CommandManager) execPlay(ctx *CommandContext) {
	input := strings.TrimSpace(strings.Join(ctx.Args, " "))
	if input == "" {
		ctx.StreamingService.SendError(ctx.Message, "Please provide a video name, URL, or search query.")
		return
	}

	if IsValidURL(input) {
		ok := ctx.StreamingService.AddToQueue(ctx.Message, input, "", "")
		ctx.StreamingService.mu.RLock()
		playing := ctx.StreamStatus.Playing
		ctx.StreamingService.mu.RUnlock()
		if ok && !playing {
			ctx.StreamingService.PlayFromQueue(ctx.Message)
		}
		return
	}

	ctx.Config.RLock()
	videosDir := ctx.Config.VideosDir
	ctx.Config.RUnlock()

	if info, err := os.Stat(videosDir); err == nil && info.IsDir() {
		refreshed := cm.refreshVideosList(videosDir)
		cm.mu.Lock()
		*ctx.Videos = refreshed
		cm.mu.Unlock()
	}

	var matched *Video
	cm.mu.RLock()
	for _, v := range *ctx.Videos {
		if strings.EqualFold(v.Name, input) {
			vCopy := v
			matched = &vCopy
			break
		}
	}
	cm.mu.RUnlock()

	if matched != nil {
		ok := ctx.StreamingService.AddToQueue(ctx.Message, matched.Path, matched.Name, "")
		ctx.StreamingService.mu.RLock()
		playing := ctx.StreamStatus.Playing
		ctx.StreamingService.mu.RUnlock()
		if ok && !playing {
			ctx.StreamingService.PlayFromQueue(ctx.Message)
		}
		return
	}

	ok := ctx.StreamingService.AddToQueue(ctx.Message, input, fmt.Sprintf("Search: %s", input), "")
	ctx.StreamingService.mu.RLock()
	playing := ctx.StreamStatus.Playing
	ctx.StreamingService.mu.RUnlock()
	if ok && !playing {
		ctx.StreamingService.PlayFromQueue(ctx.Message)
	}
}

func (cm *CommandManager) execStop(ctx *CommandContext) {
	ctx.StreamingService.mu.RLock()
	joined := ctx.StreamStatus.Joined
	ctx.StreamingService.mu.RUnlock()

	if !joined {
		ctx.StreamingService.SendError(ctx.Message, "**Already Stopped!**")
		return
	}

	ctx.StreamingService.mu.Lock()
	ctx.StreamStatus.ManualStop = true
	ctx.StreamingService.mu.Unlock()

	if ctx.StreamingService.StopAndClearQueue(ctx.Message) {
		ctx.StreamingService.SendSuccess(ctx.Message, "Stopped playing video and cleared queue.")
		utils.StreamLogs.Info("Stopped playing video and cleared queue.")
	}
}

func (cm *CommandManager) execSkip(ctx *CommandContext) {
	ctx.StreamingService.mu.RLock()
	playing := ctx.StreamStatus.Playing
	ctx.StreamingService.mu.RUnlock()

	if !playing {
		ctx.StreamingService.SendError(ctx.Message, "No video is currently playing.")
		return
	}
	ctx.StreamingService.SkipCurrent(ctx.Message)
}

func (cm *CommandManager) execQueue(ctx *CommandContext) {
	qs := ctx.StreamingService.GetQueueService()
	queueItems := qs.GetQueue()
	currentItem := qs.GetCurrent()
	queueStatus := qs.GetQueueStatus()

	if len(queueItems) == 0 {
		ctx.StreamingService.SendInfo(ctx.Message, "Queue", "The queue is currently empty.")
		return
	}

	plural := "s"
	if len(queueItems) == 1 {
		plural = ""
	}
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("📋 **Queue** (%d item%s)\n\n", len(queueItems), plural))

	if queueStatus.IsPlaying && currentItem != nil {
		status := "⏳"
		title := fmt.Sprintf("%s (resolving...)", currentItem.Title)
		if currentItem.Resolved {
			status = "▶️"
			title = currentItem.Title
		}
		sb.WriteString(fmt.Sprintf("%s **Currently Playing:**\n`%s` (requested by %s)\n\n", status, title, currentItem.RequestedBy))
	}

	sb.WriteString("**Up Next:**\n")
	var upcoming []QueueItem
	for _, item := range queueItems {
		if !queueStatus.IsPlaying || currentItem == nil || item.ID != currentItem.ID {
			upcoming = append(upcoming, item)
		}
	}

	if len(upcoming) == 0 {
		if queueStatus.IsPlaying && currentItem != nil {
			sb.WriteString("*No upcoming items*\n")
		} else {
			sb.WriteString("*Queue is empty*\n")
		}
	} else {
		for idx, item := range upcoming {
			pos := idx
			if queueStatus.IsPlaying {
				pos = idx + 1
			}
			addedTime := item.AddedAt.Format("15:04:05")
			status := "⏳"
			title := fmt.Sprintf("%s (pending)", item.Title)
			if item.Resolved {
				status = ""
				title = item.Title
			}
			sb.WriteString(fmt.Sprintf("%d. %s `%s` (by %s) - Added at %s\n", pos+1, status, title, item.RequestedBy, addedTime))
		}
	}

	queueText := sb.String()
	rc := ctx.StreamingService.GetRestClient()
	if rc == nil {
		return
	}
	if len(queueText) > 1900 {
		firstPart := queueText[:1900] + "..."
		secondPart := "...(continued)\n" + queueText[1900:]
		_, _ = rc.SendMessage(ctx.Message.ChannelID, firstPart, "")
		_, _ = rc.SendMessage(ctx.Message.ChannelID, secondPart, "")
	} else {
		_, _ = rc.SendMessage(ctx.Message.ChannelID, queueText, "")
	}
}

func (cm *CommandManager) execLoop(ctx *CommandContext) {
	newState := !ctx.StreamingService.IsLoopActive()
	if len(ctx.Args) > 0 {
		arg := strings.ToLower(ctx.Args[0])
		if arg == "on" || arg == "true" || arg == "1" {
			newState = true
		} else if arg == "off" || arg == "false" || arg == "0" {
			newState = false
		}
	}

	ctx.StreamingService.SetLoop(newState)
	label := "DISABLED"
	if newState {
		label = "ENABLED (Will repeat videos endlessly)"
	}
	ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Stream loop mode is now **%s**.", label))
}

func (cm *CommandManager) execFarm(ctx *CommandContext) {
	subCommand := "status"
	if len(ctx.Args) > 0 {
		subCommand = strings.ToLower(ctx.Args[0])
	}
	viewerSvc := ctx.StreamingService.GetViewerService()

	switch subCommand {
	case "status":
		cm.showFarmStatus(ctx, viewerSvc)
	case "loop":
		newState := !ctx.StreamingService.IsLoopActive()
		if len(ctx.Args) > 1 {
			arg := strings.ToLower(ctx.Args[1])
			if arg == "on" || arg == "true" || arg == "1" {
				newState = true
			} else if arg == "off" || arg == "false" || arg == "0" {
				newState = false
			}
		}
		ctx.StreamingService.SetLoop(newState)
		label := "DISABLED"
		if newState {
			label = "ENABLED (Endless stream)"
		}
		ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Stream loop mode for AFK farming is now **%s**.", label))
	case "watch":
		if viewerSvc == nil || !viewerSvc.IsConfigured() {
			ctx.StreamingService.SendError(ctx.Message, "Viewer token is not configured. Add `VIEWER_TOKEN` in `.env` to enable stream watching.")
			return
		}
		ctx.StreamingService.mu.RLock()
		playing := ctx.StreamStatus.Playing
		joined := ctx.StreamStatus.Joined
		guildID := ctx.StreamStatus.ChannelInfo.GuildID
		channelID := ctx.StreamStatus.ChannelInfo.ChannelID
		ctx.StreamingService.mu.RUnlock()

		if !playing || !joined {
			ctx.StreamingService.SendError(ctx.Message, "Streamer is not currently streaming. Start a stream first with `$play`.")
			return
		}

		ctx.Config.RLock()
		if guildID == "" {
			guildID = ctx.Config.GuildID
		}
		if channelID == "" {
			channelID = ctx.Config.VideoChannelID
		}
		ctx.Config.RUnlock()

		gw := ctx.StreamingService.GetClient()
		streamerID := ""
		if gw != nil {
			streamerID = gw.UserID()
		}
		if guildID == "" || channelID == "" || streamerID == "" {
			ctx.StreamingService.SendError(ctx.Message, "Missing stream channel information.")
			return
		}

		ctx.StreamingService.SendInfo(ctx.Message, "Farm Watcher", "Viewer account is connecting to watch stream...")
		if viewerSvc.WatchStream(guildID, channelID, streamerID) {
			ctx.StreamingService.SendSuccess(ctx.Message, "Viewer account is now watching the stream! Stream hours are counting.")
		} else {
			ctx.StreamingService.SendError(ctx.Message, "Failed to connect viewer account to stream.")
		}
	case "stop":
		if viewerSvc != nil {
			viewerSvc.StopWatching()
			ctx.StreamingService.SendSuccess(ctx.Message, "Viewer stopped watching the stream.")
		} else {
			ctx.StreamingService.SendError(ctx.Message, "Viewer service is not active.")
		}
	default:
		ctx.Config.RLock()
		prefix := ctx.Config.Prefix
		ctx.Config.RUnlock()
		ctx.StreamingService.SendError(
			ctx.Message,
			fmt.Sprintf("Unknown sub-command: `%s`. Use `%sfarm status`, `loop`, `watch`, or `stop`.", subCommand, prefix),
		)
	}
}

func (cm *CommandManager) showFarmStatus(ctx *CommandContext, viewerSvc *ViewerService) {
	var stats FarmStats
	if viewerSvc != nil {
		stats = viewerSvc.GetFarmStats()
	}
	isLooping := ctx.StreamingService.IsLoopActive()

	statusIcon := "🔴 Inactive"
	if stats.IsWatching {
		statusIcon = "🟢 Actively Watching & Farming"
	} else if stats.IsOnline {
		statusIcon = "🟡 Online & Standby (Auto-watch on stream)"
	} else if !stats.IsConfigured {
		statusIcon = "⚪ Not Configured (Missing VIEWER_TOKEN in .env)"
	}

	viewerTag := stats.ViewerTag
	if viewerTag == "" {
		viewerTag = "None"
	}
	sessTime := stats.FormattedSessionTime
	if sessTime == "" {
		sessTime = "0m 0s"
	}
	totTime := stats.FormattedTotalTime
	if totTime == "" {
		totTime = "0m 0s"
	}
	loopStr := "OFF"
	if isLooping {
		loopStr = "ON (24/7 AFK Farm)"
	}

	ctx.StreamingService.mu.RLock()
	playing := ctx.StreamStatus.Playing
	ctx.StreamingService.mu.RUnlock()
	streamerState := "⏹️ Idle"
	if playing {
		streamerState = "🎬 Streaming"
	}

	ctx.Config.RLock()
	prefix := ctx.Config.Prefix
	ctx.Config.RUnlock()

	lines := []string{
		"🌾 **Discord Stream Farming & Badge Status**",
		"",
		fmt.Sprintf("• **Watcher Status**: %s", statusIcon),
		fmt.Sprintf("• **Viewer Account**: `%s`", viewerTag),
		fmt.Sprintf("• **Current Session**: `%s`", sessTime),
		fmt.Sprintf("• **Total Farmed Time**: `%s`", totTime),
		fmt.Sprintf("• **Endless Loop Mode**: **%s**", loopStr),
		fmt.Sprintf("• **Streamer State**: %s", streamerState),
		"",
		fmt.Sprintf("*Tip: Use `%sfarm loop on` to loop playback endlessly for overnight farming.*", prefix),
	}

	ctx.StreamingService.SendInfo(ctx.Message, "Stream Farm", strings.Join(lines, "\n"))
}

func (cm *CommandManager) isAdmin(cfg *config.StreamConfig, userID string) bool {
	cfg.RLock()
	defer cfg.RUnlock()
	if len(cfg.AdminIDs) == 0 {
		return true
	}
	for _, id := range cfg.AdminIDs {
		if id == userID {
			return true
		}
	}
	return false
}

func (cm *CommandManager) execConfig(ctx *CommandContext) {
	if !cm.isAdmin(ctx.Config, ctx.Message.Author.ID) {
		ctx.StreamingService.SendError(ctx.Message, "You don't have permission to use this command. Admin access required.")
		utils.StreamLogs.Warn("Unauthorized config command attempt by user %s", ctx.Message.Author.ID)
		return
	}

	if len(ctx.Args) == 0 {
		cm.showFullConfig(ctx)
		return
	}
	if len(ctx.Args) == 1 {
		cm.showConfigParam(ctx, ctx.Args[0])
		return
	}
	param := strings.ToLower(ctx.Args[0])
	val := strings.Join(ctx.Args[1:], " ")
	cm.setConfigParam(ctx, param, val)
}

func (cm *CommandManager) showFullConfig(ctx *CommandContext) {
	ctx.Config.RLock()
	maxW := "None"
	if ctx.Config.MaxWidth > 0 {
		maxW = strconv.Itoa(ctx.Config.MaxWidth)
	}
	maxH := "None"
	if ctx.Config.MaxHeight > 0 {
		maxH = strconv.Itoa(ctx.Config.MaxHeight)
	}
	cookies := ctx.Config.YtdlpCookiesPath
	if cookies == "" {
		cookies = "(not set)"
	}

	lines := []string{
		"**Stream Options:**",
		fmt.Sprintf("• respect_video_params: %v", ctx.Config.RespectVideoParams),
		fmt.Sprintf("• bitrateOverride: %v", ctx.Config.BitrateOverride),
		fmt.Sprintf("• width: %d", ctx.Config.Width),
		fmt.Sprintf("• height: %d", ctx.Config.Height),
		fmt.Sprintf("• fps: %d", ctx.Config.FPS),
		fmt.Sprintf("• bitrateKbps: %d", ctx.Config.BitrateKbps),
		fmt.Sprintf("• maxBitrateKbps: %d", ctx.Config.MaxBitrateKbps),
		fmt.Sprintf("• maxWidth: %s", maxW),
		fmt.Sprintf("• maxHeight: %s", maxH),
		fmt.Sprintf("• hardwareAcceleratedDecoding: %v", ctx.Config.HardwareAcceleratedDecoding),
		fmt.Sprintf("• h26xPreset: %s", ctx.Config.H26xPreset),
		fmt.Sprintf("• videoCodec: %s", ctx.Config.VideoCodec),
		"",
		"**General Options:**",
		fmt.Sprintf("• videosDir: %s", ctx.Config.VideosDir),
		fmt.Sprintf("• previewCacheDir: %s", ctx.Config.PreviewCacheDir),
		"",
		"**yt-dlp Options:**",
		fmt.Sprintf("• ytdlpCookiesPath: %s", cookies),
		"",
		"Use `config <parameter>` to view a specific parameter",
		"Use `config <parameter> <value>` to change a parameter",
	}
	ctx.Config.RUnlock()

	ctx.StreamingService.SendInfo(ctx.Message, "Bot Configuration", strings.Join(lines, "\n"))
}

func (cm *CommandManager) showConfigParam(ctx *CommandContext, param string) {
	ctx.Config.RLock()
	defer ctx.Config.RUnlock()

	p := strings.ToLower(param)
	var keyName string
	var valStr string

	switch p {
	case "respect_video_params":
		keyName, valStr = "respect_video_params", fmt.Sprintf("%v", ctx.Config.RespectVideoParams)
	case "bitrateoverride":
		keyName, valStr = "bitrateOverride", fmt.Sprintf("%v", ctx.Config.BitrateOverride)
	case "width":
		keyName, valStr = "width", strconv.Itoa(ctx.Config.Width)
	case "height":
		keyName, valStr = "height", strconv.Itoa(ctx.Config.Height)
	case "fps":
		keyName, valStr = "fps", strconv.Itoa(ctx.Config.FPS)
	case "bitratekbps":
		keyName, valStr = "bitrateKbps", strconv.Itoa(ctx.Config.BitrateKbps)
	case "maxbitratekbps":
		keyName, valStr = "maxBitrateKbps", strconv.Itoa(ctx.Config.MaxBitrateKbps)
	case "maxwidth":
		keyName, valStr = "maxWidth", strconv.Itoa(ctx.Config.MaxWidth)
	case "maxheight":
		keyName, valStr = "maxHeight", strconv.Itoa(ctx.Config.MaxHeight)
	case "hardwareaccelerateddecoding":
		keyName, valStr = "hardwareAcceleratedDecoding", fmt.Sprintf("%v", ctx.Config.HardwareAcceleratedDecoding)
	case "h26xpreset":
		keyName, valStr = "h26xPreset", string(ctx.Config.H26xPreset)
	case "videocodec":
		keyName, valStr = "videoCodec", string(ctx.Config.VideoCodec)
	case "videosdir":
		keyName, valStr = "videosDir", ctx.Config.VideosDir
	case "previewcachedir":
		keyName, valStr = "previewCacheDir", ctx.Config.PreviewCacheDir
	case "ytdlpcookiespath":
		keyName, valStr = "ytdlpCookiesPath", ctx.Config.YtdlpCookiesPath
	default:
		ctx.StreamingService.SendError(ctx.Message, fmt.Sprintf("Unknown parameter: %s", param))
		return
	}

	ctx.StreamingService.SendInfo(ctx.Message, fmt.Sprintf("Config: %s", keyName), fmt.Sprintf("Current value: `%s`", valStr))
}

func (cm *CommandManager) setConfigParam(ctx *CommandContext, param, value string) {
	p := strings.ToLower(param)
	switch p {
	case "respect_video_params", "bitrateoverride", "hardwareaccelerateddecoding":
		bVal := config.ParseBoolean(value)
		ctx.Config.Lock()
		var keyName string
		switch p {
		case "respect_video_params":
			ctx.Config.RespectVideoParams = bVal
			keyName = "respect_video_params"
		case "bitrateoverride":
			ctx.Config.BitrateOverride = bVal
			keyName = "bitrateOverride"
		case "hardwareaccelerateddecoding":
			ctx.Config.HardwareAcceleratedDecoding = bVal
			keyName = "hardwareAcceleratedDecoding"
		}
		ctx.Config.Unlock()
		ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Set %s to `%v`", keyName, bVal))
		utils.StreamLogs.Info("Config updated: %s = %v", keyName, bVal)

	case "width", "height", "fps", "bitratekbps", "maxbitratekbps", "maxwidth", "maxheight":
		numVal, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || numVal < 0 {
			ctx.StreamingService.SendError(ctx.Message, fmt.Sprintf("Invalid number value: %s. Must be non-negative.", value))
			return
		}
		if (p == "width" || p == "height" || p == "fps" || p == "bitratekbps" || p == "maxbitratekbps") && numVal == 0 {
			ctx.StreamingService.SendError(ctx.Message, fmt.Sprintf("Invalid number value: %s. Must be greater than 0.", value))
			return
		}
		ctx.Config.Lock()
		var keyName string
		switch p {
		case "width":
			ctx.Config.Width = numVal
			keyName = "width"
		case "height":
			ctx.Config.Height = numVal
			keyName = "height"
		case "fps":
			ctx.Config.FPS = numVal
			keyName = "fps"
		case "bitratekbps":
			ctx.Config.BitrateKbps = numVal
			keyName = "bitrateKbps"
		case "maxbitratekbps":
			ctx.Config.MaxBitrateKbps = numVal
			keyName = "maxBitrateKbps"
		case "maxwidth":
			ctx.Config.MaxWidth = numVal
			keyName = "maxWidth"
		case "maxheight":
			ctx.Config.MaxHeight = numVal
			keyName = "maxHeight"
		}
		ctx.Config.Unlock()
		ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Set %s to `%d`", keyName, numVal))
		utils.StreamLogs.Info("Config updated: %s = %d", keyName, numVal)

	case "videocodec":
		norm := strings.ToUpper(strings.TrimSpace(value))
		valid := map[string]bool{"H264": true, "H265": true, "VP8": true, "VP9": true, "AV1": true}
		if !valid[norm] {
			ctx.StreamingService.SendError(ctx.Message, "Invalid video codec. Valid options: H264, H265, VP8, VP9, AV1")
			return
		}
		parsed := config.ParseVideoCodec(norm)
		ctx.Config.Lock()
		ctx.Config.VideoCodec = parsed
		ctx.Config.Unlock()
		ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Set videoCodec to `%s`", parsed))
		utils.StreamLogs.Info("Config updated: videoCodec = %s", parsed)

	case "h26xpreset":
		norm := strings.ToLower(strings.TrimSpace(value))
		valid := map[string]bool{
			"ultrafast": true, "superfast": true, "veryfast": true,
			"faster": true, "fast": true, "medium": true,
			"slow": true, "slower": true, "veryslow": true,
		}
		if !valid[norm] {
			ctx.StreamingService.SendError(ctx.Message, "Invalid preset. Valid options: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow")
			return
		}
		parsed := config.ParsePreset(norm)
		ctx.Config.Lock()
		ctx.Config.H26xPreset = parsed
		ctx.Config.Unlock()
		ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Set h26xPreset to `%s`", parsed))
		utils.StreamLogs.Info("Config updated: h26xPreset = %s", parsed)

	case "videosdir", "previewcachedir", "ytdlpcookiespath":
		ctx.Config.Lock()
		var keyName string
		switch p {
		case "videosdir":
			ctx.Config.VideosDir = value
			keyName = "videosDir"
		case "previewcachedir":
			ctx.Config.PreviewCacheDir = value
			keyName = "previewCacheDir"
		case "ytdlpcookiespath":
			ctx.Config.YtdlpCookiesPath = value
			keyName = "ytdlpCookiesPath"
		}
		ctx.Config.Unlock()
		ctx.StreamingService.SendSuccess(ctx.Message, fmt.Sprintf("Set %s to `%s`", keyName, value))
		utils.StreamLogs.Info("Config updated: %s = %s", keyName, value)

	default:
		ctx.StreamingService.SendError(ctx.Message, fmt.Sprintf("Unknown parameter: %s", param))
	}
}

func (cm *CommandManager) execPreview(ctx *CommandContext) {
	targetName := strings.TrimSpace(strings.Join(ctx.Args, " "))
	if targetName == "" {
		ctx.StreamingService.SendError(ctx.Message, "Please provide a video name.")
		return
	}

	var matched *Video
	cm.mu.RLock()
	for _, v := range *ctx.Videos {
		if strings.EqualFold(v.Name, targetName) {
			vCopy := v
			matched = &vCopy
			break
		}
	}
	cm.mu.RUnlock()

	if matched == nil {
		ctx.StreamingService.SendError(ctx.Message, "Video not found.")
		return
	}

	rc := ctx.StreamingService.GetRestClient()
	if rc == nil {
		return
	}
	_ = rc.AddReaction(ctx.Message.ChannelID, ctx.Message.ID, "📸")
	_, _ = rc.SendMessage(ctx.Message.ChannelID, "📸 **Generating preview thumbnails...**", ctx.Message.ID)

	ctx.Config.RLock()
	videosDir := ctx.Config.VideosDir
	previewCacheDir := ctx.Config.PreviewCacheDir
	ctx.Config.RUnlock()

	videoFilename := filepath.Base(matched.Path)
	thumbnails, err := FFmpegScreenshot(videosDir, previewCacheDir, videoFilename)
	if err != nil || len(thumbnails) == 0 {
		utils.StreamLogs.Error("Error generating preview thumbnails: %v", err)
		ctx.StreamingService.SendError(ctx.Message, "Failed to generate preview thumbnails.")
		return
	}

	_, _ = rc.SendMessageWithFiles(
		ctx.Message.ChannelID,
		fmt.Sprintf("📸 **Preview**: `%s`", matched.Name),
		ctx.Message.ID,
		thumbnails,
	)
}

func (cm *CommandManager) execYtSearch(ctx *CommandContext) {
	query := strings.TrimSpace(strings.Join(ctx.Args, " "))
	if query == "" {
		ctx.StreamingService.SendError(ctx.Message, "Please provide a search query.")
		return
	}

	results := ctx.StreamingService.GetMediaService().SearchYouTube(query, 5)
	if len(results) > 0 {
		ctx.StreamingService.SendList(ctx.Message, results, "ytsearch")
	} else {
		ctx.StreamingService.SendError(ctx.Message, "No videos found.")
	}
}
