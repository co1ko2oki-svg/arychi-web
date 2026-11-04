package stream

import (
	"encoding/json"
	"math"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/discord/gateway"
	"arychi-web/backend/internal/utils"
)

type FarmStats struct {
	IsConfigured          bool   `json:"isConfigured"`
	IsOnline              bool   `json:"isOnline"`
	IsWatching            bool   `json:"isWatching"`
	ViewerTag             string `json:"viewerTag"`
	CurrentSessionSeconds int64  `json:"currentSessionSeconds"`
	TotalFarmedSeconds    int64  `json:"totalFarmedSeconds"`
	FormattedSessionTime  string `json:"formattedSessionTime"`
	FormattedTotalTime    string `json:"formattedTotalTime"`
}

type ViewerService struct {
	mu                 sync.RWMutex
	cfg                *config.StreamConfig
	client             *gateway.Client
	isOnline           bool
	isWatching         bool
	sessionStartTime   *time.Time
	totalFarmedSeconds int64
	targetGuildID      string
	targetChannelID    string
	targetStreamerID   string
	currentStreamKey   string
}

func NewViewerService(cfg *config.StreamConfig) *ViewerService {
	return &ViewerService{
		cfg: cfg,
	}
}

func (v *ViewerService) IsConfigured() bool {
	if v.cfg == nil {
		return false
	}
	v.cfg.RLock()
	defer v.cfg.RUnlock()
	return len(strings.TrimSpace(v.cfg.ViewerToken)) > 0
}

func (v *ViewerService) setupClient(token string) *gateway.Client {
	gw := gateway.NewClient(gateway.ClientOptions{
		Token:  token,
		Logger: utils.StreamLogs,
	})

	gw.OnReady(func(r *events.ReadyData) {
		v.mu.Lock()
		v.isOnline = true
		tag := r.User.Username
		if r.User.Discriminator != "" && r.User.Discriminator != "0" {
			tag = r.User.Username + "#" + r.User.Discriminator
		}
		v.mu.Unlock()
		utils.StreamLogs.Info("[Viewer Farm] Logged in as %s (Stream watcher active)", tag)
	})

	gw.OnEvent(events.EventVoiceStateUpdate, func(_ string, raw json.RawMessage) {
		var vs events.VoiceState
		if json.Unmarshal(raw, &vs) != nil {
			return
		}
		v.mu.RLock()
		client := v.client
		watching := v.isWatching
		v.mu.RUnlock()

		if client != nil && vs.UserID == client.UserID() && vs.ChannelID == nil && watching {
			utils.StreamLogs.Warn("[Viewer Farm] Viewer was disconnected from voice channel.")
			v.StopWatching()
		}
	})

	return gw
}

func (v *ViewerService) Start() {
	if !v.IsConfigured() {
		utils.StreamLogs.Info("[Viewer Farm] VIEWER_TOKEN not provided. Stream farming watcher is disabled.")
		return
	}

	v.cfg.RLock()
	token := v.cfg.ViewerToken
	v.cfg.RUnlock()

	utils.StreamLogs.Info("[Viewer Farm] Logging in stream watcher client...")
	gw := v.setupClient(token)
	v.mu.Lock()
	v.client = gw
	v.mu.Unlock()

	if err := gw.Connect(); err != nil {
		utils.StreamLogs.Error("[Viewer Farm] Failed to login viewer client with provided VIEWER_TOKEN: %v", err)
	}
}

func (v *ViewerService) UpdateTokenAndLogin(newToken string) bool {
	cleaned := strings.TrimSpace(newToken)
	if v.cfg != nil {
		v.cfg.Lock()
		v.cfg.ViewerToken = cleaned
		v.cfg.Unlock()
	}

	if !v.IsConfigured() {
		v.StopWatching()
		v.mu.Lock()
		if v.client != nil {
			v.client.Close()
			v.client = nil
		}
		v.isOnline = false
		v.mu.Unlock()
		return false
	}

	v.StopWatching()
	v.mu.Lock()
	if v.client != nil {
		v.client.Close()
		v.client = nil
	}
	gw := v.setupClient(cleaned)
	v.client = gw
	v.mu.Unlock()

	if err := gw.Connect(); err != nil {
		v.mu.Lock()
		v.isOnline = false
		v.mu.Unlock()
		utils.StreamLogs.Error("[Viewer Farm] Failed to login with updated VIEWER_TOKEN: %v", err)
		return false
	}

	v.mu.Lock()
	v.isOnline = true
	v.mu.Unlock()
	return true
}

func (v *ViewerService) WatchStream(guildID, channelID, streamerUserID string) bool {
	v.mu.RLock()
	online := v.isOnline
	watching := v.isWatching
	streamKey := v.currentStreamKey
	gw := v.client
	v.mu.RUnlock()

	if !v.IsConfigured() || !online || gw == nil {
		return false
	}

	v.mu.Lock()
	v.targetGuildID = guildID
	v.targetChannelID = channelID
	v.targetStreamerID = streamerUserID
	v.mu.Unlock()

	if watching && streamKey != "" {
		return true
	}

	utils.StreamLogs.Info("[Viewer Farm] Viewer joining voice channel: (%s)...", channelID)
	chID := channelID
	if err := gw.UpdateVoiceState(guildID, &chID, true, true, false); err != nil {
		utils.StreamLogs.Error("[Viewer Farm] Error while joining voice channel: %v", err)
		v.cleanupConnections()
		return false
	}

	isStreaming := v.waitForStreamerStreaming(gw, guildID, streamerUserID, 15*time.Second)
	if !isStreaming {
		utils.StreamLogs.Warn("[Viewer Farm] Streamer %s not reporting active stream within 15s. Watching might be delayed.", streamerUserID)
	}

	utils.StreamLogs.Info("[Viewer Farm] Sending STREAM_WATCH for streamer %s...", streamerUserID)
	key := gateway.GenerateStreamKey("guild", guildID, channelID, streamerUserID)
	if err := gw.WatchStream(key); err != nil {
		utils.StreamLogs.Error("[Viewer Farm] Error while joining stream watch: %v", err)
		v.cleanupConnections()
		return false
	}

	now := time.Now()
	v.mu.Lock()
	v.currentStreamKey = key
	v.isWatching = true
	v.sessionStartTime = &now
	v.mu.Unlock()

	utils.StreamLogs.Info("[Viewer Farm] SUCCESS: Viewer is now watching the stream. Discord stream hours are now accumulating!")
	return true
}

func (v *ViewerService) waitForStreamerStreaming(gw *gateway.Client, guildID, streamerUserID string, maxWait time.Duration) bool {
	deadline := time.Now().Add(maxWait)
	for time.Now().Before(deadline) {
		if vs := gw.Session().GetVoiceState(guildID, streamerUserID); vs != nil && vs.SelfStream {
			return true
		}
		time.Sleep(1 * time.Second)
	}
	return false
}

func (v *ViewerService) StopWatching() {
	v.mu.Lock()
	if v.sessionStartTime != nil {
		elapsed := int64(math.Round(time.Since(*v.sessionStartTime).Seconds()))
		v.totalFarmedSeconds += elapsed
		utils.StreamLogs.Info(
			"[Viewer Farm] Stream watch ended. Session duration: %s. Total farmed: %s",
			utils.FormatDuration(elapsed),
			utils.FormatDuration(v.totalFarmedSeconds),
		)
	}
	v.sessionStartTime = nil
	v.isWatching = false
	v.mu.Unlock()

	v.cleanupConnections()
}

func (v *ViewerService) cleanupConnections() {
	v.mu.Lock()
	gw := v.client
	key := v.currentStreamKey
	guildID := v.targetGuildID
	v.currentStreamKey = ""
	v.mu.Unlock()

	if gw != nil {
		if key != "" {
			_ = gw.DeleteStream(key)
		}
		if guildID != "" {
			_ = gw.UpdateVoiceState(guildID, nil, true, true, false)
		}
	}
}

func (v *ViewerService) GetFarmStats() FarmStats {
	v.mu.RLock()
	online := v.isOnline
	watching := v.isWatching
	startTime := v.sessionStartTime
	totalBase := v.totalFarmedSeconds
	gw := v.client
	v.mu.RUnlock()

	var currentSessionSeconds int64
	if watching && startTime != nil {
		currentSessionSeconds = int64(math.Round(time.Since(*startTime).Seconds()))
	}
	totalSeconds := totalBase + currentSessionSeconds

	viewerTag := "Not connected"
	if gw != nil && gw.UserTag() != "Not Logged In" {
		viewerTag = gw.UserTag()
	}

	return FarmStats{
		IsConfigured:          v.IsConfigured(),
		IsOnline:              online,
		IsWatching:            watching,
		ViewerTag:             viewerTag,
		CurrentSessionSeconds: currentSessionSeconds,
		TotalFarmedSeconds:    totalSeconds,
		FormattedSessionTime:  utils.FormatDuration(currentSessionSeconds),
		FormattedTotalTime:    utils.FormatDuration(totalSeconds),
	}
}

func (v *ViewerService) Close() {
	v.StopWatching()
	v.mu.Lock()
	if v.client != nil {
		v.client.Close()
		v.client = nil
	}
	v.isOnline = false
	v.mu.Unlock()
}
