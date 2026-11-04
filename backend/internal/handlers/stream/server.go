package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/database"
	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/discord/gateway"
	"arychi-web/backend/internal/discord/rest"
	streamsvc "arychi-web/backend/internal/services/stream"
	"arychi-web/backend/internal/utils"
	"github.com/gorilla/websocket"
)

type Server struct {
	Config              *config.StreamConfig
	StreamStatus        *streamsvc.StreamStatus
	QueueService        *streamsvc.QueueService
	ViewerService       *streamsvc.ViewerService
	StreamingService    *streamsvc.StreamingService
	CommandManager      *streamsvc.CommandManager
	SubscriptionManager *database.SubscriptionManager

	mu         sync.RWMutex
	mainClient *gateway.Client
	restClient *rest.Client
	httpServer *http.Server

	wsMu      sync.Mutex
	wsClients map[*wsStreamClient]bool
	upgrader  websocket.Upgrader
	stopCh    chan struct{}
	unsubLogs func()
}

type wsStreamClient struct {
	conn    *websocket.Conn
	writeMu sync.Mutex
}

func (c *wsStreamClient) sendJSON(v any) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return c.conn.WriteJSON(v)
}

func NewServer(cfg *config.StreamConfig, subMgr *database.SubscriptionManager) *Server {
	if cfg == nil {
		cfg = config.LoadStreamConfig()
	}
	if subMgr == nil {
		subMgr = database.NewSubscriptionManager()
	}

	_ = os.MkdirAll(cfg.VideosDir, 0755)
	_ = os.MkdirAll(cfg.PreviewCacheDir, 0755)

	var initialVideos []streamsvc.Video
	if entries, err := os.ReadDir(cfg.VideosDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				name := entry.Name()
				base := strings.TrimSuffix(name, filepath.Ext(name))
				initialVideos = append(initialVideos, streamsvc.Video{
					Name: base,
					Path: filepath.Join(cfg.VideosDir, name),
				})
			}
		}
	}
	if len(initialVideos) > 0 {
		var names []string
		for _, v := range initialVideos {
			names = append(names, v.Name)
		}
		utils.StreamLogs.Info("Available videos:\n%s", strings.Join(names, "\n"))
	}

	queueSvc := streamsvc.NewQueueService()
	viewerSvc := streamsvc.NewViewerService(cfg)

	status := &streamsvc.StreamStatus{
		Joined:     false,
		JoinSucc:   false,
		Playing:    false,
		ManualStop: false,
		IsLooping:  cfg.StreamLoop,
		ChannelInfo: streamsvc.ChannelInfo{
			GuildID:      cfg.GuildID,
			ChannelID:    cfg.VideoChannelID,
			CmdChannelID: cfg.CmdChannelID,
		},
		Queue: queueSvc.GetQueueStatus(),
	}

	streamingSvc := streamsvc.NewStreamingService(cfg, nil, nil, status, queueSvc, viewerSvc)
	cmdMgr := streamsvc.NewCommandManager(cfg, initialVideos)

	s := &Server{
		Config:              cfg,
		StreamStatus:        status,
		QueueService:        queueSvc,
		ViewerService:       viewerSvc,
		StreamingService:    streamingSvc,
		CommandManager:      cmdMgr,
		SubscriptionManager: subMgr,
		wsClients:           make(map[*wsStreamClient]bool),
		stopCh:              make(chan struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}

	s.unsubLogs = utils.StreamLogs.Subscribe(func(entry utils.LogEntry) {
		s.Broadcast(map[string]any{
			"type": "log",
			"data": entry,
		})
	})

	return s
}

func (s *Server) connectMainClient(token string) {
	cleaned := strings.TrimSpace(token)
	s.mu.Lock()
	if s.mainClient != nil {
		s.mainClient.Close()
		s.mainClient = nil
	}
	if len(cleaned) <= 10 {
		s.restClient = nil
		s.mu.Unlock()
		return
	}

	gw := gateway.NewClient(gateway.ClientOptions{
		Token:  cleaned,
		Logger: utils.StreamLogs,
	})
	rc := rest.NewClient(cleaned)
	s.mainClient = gw
	s.restClient = rc
	s.StreamingService.SetClients(gw, rc)
	s.mu.Unlock()

	gw.OnReady(func(r *events.ReadyData) {
		s.Config.RLock()
		prefix := s.Config.Prefix
		s.Config.RUnlock()
		utils.StreamLogs.Info("%s is ready", gw.UserTag())
		_ = gw.UpdateStatusIdle(prefix)
	})

	gw.OnEvent(events.EventVoiceStateUpdate, func(_ string, raw json.RawMessage) {
		s.StreamingService.HandleVoiceStateUpdate(raw)
	})

	gw.OnEvent(events.EventMessageCreate, func(_ string, raw json.RawMessage) {
		s.CommandManager.HandleMessageCreate(raw, s.StreamStatus, s.StreamingService)
	})

	go func() {
		if err := gw.Connect(); err != nil {
			utils.StreamLogs.Warn("Could not login to Discord: %v. Web API server remains active.", err)
		}
	}()
}

func (s *Server) GetFullStatus() map[string]any {
	s.mu.RLock()
	gw := s.mainClient
	s.mu.RUnlock()

	botTag := "Not Logged In"
	botID := ""
	botReady := false
	var botPing int64 = -1
	if gw != nil {
		botTag = gw.UserTag()
		botID = gw.UserID()
		botReady = gw.IsReady()
		botPing = gw.Ping()
	}

	farmStats := s.ViewerService.GetFarmStats()
	s.Config.RLock()
	autoWatch := s.Config.ViewerAutoWatch
	cfgSnapshot := map[string]any{
		"guildId":              s.Config.GuildID,
		"videoChannelId":       s.Config.VideoChannelID,
		"cmdChannelId":         s.Config.CmdChannelID,
		"width":                s.Config.Width,
		"height":               s.Config.Height,
		"fps":                  s.Config.FPS,
		"bitrateKbps":          s.Config.BitrateKbps,
		"maxBitrateKbps":       s.Config.MaxBitrateKbps,
		"videoCodec":           s.Config.VideoCodec,
		"h26xPreset":           s.Config.H26xPreset,
		"hardwareAcceleration": s.Config.HardwareAcceleratedDecoding,
		"streamLoop":           s.Config.StreamLoop,
		"viewerAutoWatch":      s.Config.ViewerAutoWatch,
		"serverPort":           s.Config.ServerPort,
		"hasMainToken":         len(strings.TrimSpace(s.Config.Token)) > 10,
		"hasViewerToken":       len(strings.TrimSpace(s.Config.ViewerToken)) > 10,
	}
	s.Config.RUnlock()

	st := s.StreamingService.GetStreamStatus()

	return map[string]any{
		"bot": map[string]any{
			"tag":     botTag,
			"id":      botID,
			"isReady": botReady,
			"ping":    botPing,
		},
		"stream": map[string]any{
			"joined":           st.Joined,
			"playing":          st.Playing,
			"isLooping":        s.StreamingService.IsLoopActive(),
			"channelInfo":      st.ChannelInfo,
			"currentQueueItem": s.QueueService.GetCurrent(),
		},
		"farm": map[string]any{
			"isConfigured":          farmStats.IsConfigured,
			"isOnline":              farmStats.IsOnline,
			"isWatching":            farmStats.IsWatching,
			"viewerTag":             farmStats.ViewerTag,
			"currentSessionSeconds": farmStats.CurrentSessionSeconds,
			"totalFarmedSeconds":    farmStats.TotalFarmedSeconds,
			"formattedSessionTime":  farmStats.FormattedSessionTime,
			"formattedTotalTime":    farmStats.FormattedTotalTime,
			"autoWatch":             autoWatch,
		},
		"queue":  s.QueueService.GetQueueStatus(),
		"config": cfgSnapshot,
	}
}

func (s *Server) Broadcast(data any) {
	s.wsMu.Lock()
	clients := make([]*wsStreamClient, 0, len(s.wsClients))
	for c := range s.wsClients {
		clients = append(clients, c)
	}
	s.wsMu.Unlock()

	for _, c := range clients {
		_ = c.sendJSON(data)
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.Handler().ServeHTTP(w, r)
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/ws", s.handleWS)
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/player/play", s.handlePlayerPlay)
	mux.HandleFunc("/api/player/stop", s.handlePlayerStop)
	mux.HandleFunc("/api/player/skip", s.handlePlayerSkip)
	mux.HandleFunc("/api/player/loop", s.handlePlayerLoop)
	mux.HandleFunc("/api/queue", s.handleQueueRoot)
	mux.HandleFunc("/api/queue/add", s.handleQueueAdd)
	mux.HandleFunc("/api/queue/move", s.handleQueueMove)
	mux.HandleFunc("/api/queue/", s.handleQueueDeleteByID)
	mux.HandleFunc("/api/farm", s.handleFarmRoot)
	mux.HandleFunc("/api/farm/watch", s.handleFarmWatch)
	mux.HandleFunc("/api/farm/stop", s.handleFarmStop)
	mux.HandleFunc("/api/farm/toggle-auto", s.handleFarmToggleAuto)
	mux.HandleFunc("/api/videos", s.handleVideosList)
	mux.HandleFunc("/api/videos/upload", s.handleVideosUpload)
	mux.HandleFunc("/api/videos/download", s.handleVideosDownload)
	mux.HandleFunc("/api/videos/", s.handleVideosDynamic)
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/config/tokens", s.handleConfigTokens)
	mux.HandleFunc("/api/logs", s.handleLogs)
	mux.HandleFunc("/", s.handleStaticFallback)

	return s.corsMiddleware(mux)
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")

		// Security Hardening Headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-XSS-Protection", "1; mode=block")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Body != nil && r.Method != http.MethodGet && r.Method != http.MethodHead {
			r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10MB payload limit
		}

		next.ServeHTTP(w, r)
	})
}

func writeStreamJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func readStreamJSONBody(r *http.Request) map[string]any {
	if r.Body == nil {
		return map[string]any{}
	}
	defer r.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body == nil {
		return map[string]any{}
	}
	return body
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &wsStreamClient{conn: conn}
	s.wsMu.Lock()
	s.wsClients[client] = true
	s.wsMu.Unlock()

	_ = client.sendJSON(map[string]any{
		"type":   "init",
		"status": s.GetFullStatus(),
	})

	defer func() {
		s.wsMu.Lock()
		delete(s.wsClients, client)
		s.wsMu.Unlock()
		_ = conn.Close()
	}()

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var parsed map[string]any
		if json.Unmarshal(msgBytes, &parsed) == nil && parsed["type"] == "ping" {
			_ = client.sendJSON(map[string]any{"type": "pong"})
		}
	}
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	writeStreamJSON(w, http.StatusOK, s.GetFullStatus())
}

func (s *Server) handlePlayerPlay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	source, _ := body["source"].(string)
	if source == "" {
		source, _ = body["query"].(string)
	}
	title, _ := body["title"].(string)
	if title == "" {
		title, _ = body["resolvedTitle"].(string)
	}

	source = strings.TrimSpace(source)
	if source == "" {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Missing video source parameter",
		})
		return
	}

	videoPathOrSource := source
	resolvedTitle := title
	if resolvedTitle == "" {
		resolvedTitle = videoPathOrSource
	}

	s.Config.RLock()
	videosDir := s.Config.VideosDir
	s.Config.RUnlock()

	if entries, err := os.ReadDir(videosDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			fName := entry.Name()
			baseName := strings.TrimSuffix(fName, filepath.Ext(fName))
			if strings.EqualFold(baseName, videoPathOrSource) || strings.EqualFold(fName, videoPathOrSource) {
				videoPathOrSource = filepath.Join(videosDir, fName)
				resolvedTitle = baseName
				break
			}
		}
	}

	added := s.StreamingService.AddToQueue(nil, videoPathOrSource, resolvedTitle, "Web Dashboard")
	if !added {
		writeStreamJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": "Failed to add source to queue",
		})
		return
	}

	st := s.StreamingService.GetStreamStatus()
	if !st.Playing {
		go s.StreamingService.PlayFromQueue(nil)
	}

	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": fmt.Sprintf("Successfully requested: %s", resolvedTitle),
		"current": s.QueueService.GetCurrent(),
	})
}

func (s *Server) handlePlayerStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	s.StreamStatus.ManualStop = true
	stopped := s.StreamingService.StopAndClearQueue(nil)
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": stopped,
		"message": "Stream stopped and queue cleared",
	})
}

func (s *Server) handlePlayerSkip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	skipped := s.StreamingService.SkipCurrent(nil)
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": skipped,
		"message": "Skipped to next video",
	})
}

func (s *Server) handlePlayerLoop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	newState := !s.StreamingService.IsLoopActive()
	if lVal, ok := body["loop"].(bool); ok {
		newState = lVal
	}
	s.StreamingService.SetLoop(newState)
	s.Config.Lock()
	s.Config.StreamLoop = newState
	s.Config.Unlock()

	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"isLooping": newState,
	})
}

func (s *Server) handleQueueRoot(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeStreamJSON(w, http.StatusOK, s.QueueService.GetQueueStatus())
	case http.MethodDelete:
		s.QueueService.ClearQueue()
		s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
		writeStreamJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"queue":   s.QueueService.GetQueueStatus(),
		})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleQueueAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	source, _ := body["source"].(string)
	title, _ := body["title"].(string)
	if strings.TrimSpace(source) == "" {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Missing source",
		})
		return
	}
	ok := s.StreamingService.AddToQueue(nil, source, title, "Web Dashboard")
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": ok,
		"queue":   s.QueueService.GetQueueStatus(),
	})
}

func (s *Server) handleQueueMove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	fromF, ok1 := body["fromIndex"].(float64)
	toF, ok2 := body["toIndex"].(float64)
	if !ok1 || !ok2 {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Invalid indices",
		})
		return
	}
	ok := s.QueueService.MoveItem(int(fromF), int(toF))
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": ok,
		"queue":   s.QueueService.GetQueueStatus(),
	})
}

func (s *Server) handleQueueDeleteByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/queue/")
	ok := s.QueueService.RemoveFromQueue(id)
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": ok,
		"queue":   s.QueueService.GetQueueStatus(),
	})
}

func (s *Server) handleFarmRoot(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		stats := s.ViewerService.GetFarmStats()
		s.Config.RLock()
		autoWatch := s.Config.ViewerAutoWatch
		s.Config.RUnlock()
		writeStreamJSON(w, http.StatusOK, map[string]any{
			"isConfigured":          stats.IsConfigured,
			"isOnline":              stats.IsOnline,
			"isWatching":            stats.IsWatching,
			"viewerTag":             stats.ViewerTag,
			"currentSessionSeconds": stats.CurrentSessionSeconds,
			"totalFarmedSeconds":    stats.TotalFarmedSeconds,
			"formattedSessionTime":  stats.FormattedSessionTime,
			"formattedTotalTime":    stats.FormattedTotalTime,
			"autoWatch":             autoWatch,
		})
	case http.MethodPost:
		s.handleFarmToggleAuto(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleFarmWatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !s.ViewerService.IsConfigured() {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "VIEWER_TOKEN is not configured",
		})
		return
	}

	st := s.StreamingService.GetStreamStatus()
	if !st.Playing || !st.Joined {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Stream is not currently playing. Start stream first.",
		})
		return
	}

	guildID := st.ChannelInfo.GuildID
	channelID := st.ChannelInfo.ChannelID
	s.Config.RLock()
	if guildID == "" {
		guildID = s.Config.GuildID
	}
	if channelID == "" {
		channelID = s.Config.VideoChannelID
	}
	s.Config.RUnlock()

	s.mu.RLock()
	gw := s.mainClient
	s.mu.RUnlock()
	streamerID := ""
	if gw != nil {
		streamerID = gw.UserID()
	}

	if guildID == "" || channelID == "" || streamerID == "" {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Missing channel or streamer info",
		})
		return
	}

	ok := s.ViewerService.WatchStream(guildID, channelID, streamerID)
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	msg := "Failed to join stream watch"
	if ok {
		msg = "Viewer is watching the stream"
	}
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": ok,
		"message": msg,
	})
}

func (s *Server) handleFarmStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	s.ViewerService.StopWatching()
	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Viewer stopped watching",
	})
}

func (s *Server) handleFarmToggleAuto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	s.Config.Lock()
	if aw, ok := body["autoWatch"].(bool); ok {
		s.Config.ViewerAutoWatch = aw
	} else {
		s.Config.ViewerAutoWatch = !s.Config.ViewerAutoWatch
	}
	cur := s.Config.ViewerAutoWatch
	s.Config.Unlock()

	s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"viewerAutoWatch": cur,
		"autoWatch":       cur,
	})
}

func (s *Server) handleVideosList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	s.Config.RLock()
	videosDir := s.Config.VideosDir
	s.Config.RUnlock()

	_ = os.MkdirAll(videosDir, 0755)
	entries, err := os.ReadDir(videosDir)
	if err != nil {
		writeStreamJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": "Failed to read videos directory",
		})
		return
	}

	var videoList []map[string]any
	for _, entry := range entries {
		if entry.IsDir() || strings.HasPrefix(entry.Name(), "ytdlp_temp_") {
			continue
		}
		fName := entry.Name()
		fullPath := filepath.Join(videosDir, fName)
		info, err := os.Stat(fullPath)
		if err != nil {
			continue
		}
		ext := strings.ToLower(filepath.Ext(fName))
		baseName := strings.TrimSuffix(fName, filepath.Ext(fName))
		videoList = append(videoList, map[string]any{
			"name":          fName,
			"baseName":      baseName,
			"size":          info.Size(),
			"formattedSize": utils.FormatBytes(info.Size()),
			"ext":           ext,
			"mtime":         info.ModTime().UTC().Format(time.RFC3339),
			"thumbnailUrl":  fmt.Sprintf("/api/videos/%s/preview", url.PathEscape(fName)),
		})
	}
	if videoList == nil {
		videoList = []map[string]any{}
	}

	writeStreamJSON(w, http.StatusOK, map[string]any{"videos": videoList})
}

var unsafeFilenameRe = regexp.MustCompile(`[^a-zA-Z0-9._-]`)

func (s *Server) handleVideosUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "No file uploaded",
		})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "No file uploaded",
		})
		return
	}
	defer file.Close()

	s.Config.RLock()
	videosDir := s.Config.VideosDir
	s.Config.RUnlock()
	_ = os.MkdirAll(videosDir, 0755)

	safeName := unsafeFilenameRe.ReplaceAllString(header.Filename, "_")
	outPath := filepath.Join(videosDir, safeName)
	outFile, err := os.Create(outPath)
	if err != nil {
		writeStreamJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	written, err := io.Copy(outFile, file)
	_ = outFile.Close()
	if err != nil {
		writeStreamJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	utils.StreamLogs.Info("Video uploaded successfully: %s (%s)", safeName, utils.FormatBytes(written))
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success":       true,
		"filename":      safeName,
		"size":          written,
		"formattedSize": utils.FormatBytes(written),
	})
}

func (s *Server) handleVideosDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	targetURL, _ := body["url"].(string)
	targetURL = strings.TrimSpace(targetURL)
	if targetURL == "" {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Missing URL parameter",
		})
		return
	}

	s.Config.RLock()
	videosDir := s.Config.VideosDir
	cookies := s.Config.YtdlpCookiesPath
	s.Config.RUnlock()

	_ = os.MkdirAll(videosDir, 0755)
	targetFilename := fmt.Sprintf("video_%d.mp4", time.Now().UnixMilli())
	outputPath := filepath.Join(videosDir, targetFilename)

	utils.StreamLogs.Info("Starting download request from UI for: %s", targetURL)

	go func() {
		_ = streamsvc.DownloadYtDlpExecutable()
		cmd := streamsvc.ExecYtDlpCommand(
			targetURL,
			cookies,
			"--output", outputPath,
			"--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
			"--no-playlist",
		)
		if err := cmd.Run(); err != nil {
			utils.StreamLogs.Error("Download error for %s: %v", targetURL, err)
			return
		}
		utils.StreamLogs.Info("Download completed: %s", targetFilename)
		s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
	}()

	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"message":  "Download process started in background",
		"filename": targetFilename,
	})
}

func (s *Server) handleVideosDynamic(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/videos/")
	parts := strings.Split(sub, "/")
	if len(parts) == 0 || parts[0] == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	filename, err := url.PathUnescape(parts[0])
	if err != nil {
		filename = parts[0]
	}

	s.Config.RLock()
	videosDir := s.Config.VideosDir
	previewCacheDir := s.Config.PreviewCacheDir
	s.Config.RUnlock()

	videoPath := filepath.Join(videosDir, filepath.Base(filename))

	if len(parts) == 1 && r.Method == http.MethodDelete {
		if _, err := os.Stat(videoPath); err != nil {
			writeStreamJSON(w, http.StatusNotFound, map[string]any{
				"success": false,
				"message": "File not found",
			})
			return
		}
		if err := os.Remove(videoPath); err != nil {
			writeStreamJSON(w, http.StatusInternalServerError, map[string]any{
				"success": false,
				"message": "Failed to delete file",
			})
			return
		}
		preview1 := filepath.Join(previewCacheDir, fmt.Sprintf("%s-1.jpg", filepath.Base(filename)))
		_ = os.Remove(preview1)
		utils.StreamLogs.Info("Video deleted: %s", filename)
		writeStreamJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": fmt.Sprintf("Deleted %s", filename),
		})
		return
	}

	if len(parts) == 2 && parts[1] == "preview" && r.Method == http.MethodGet {
		if _, err := os.Stat(videoPath); err != nil {
			http.Error(w, "Video file not found", http.StatusNotFound)
			return
		}
		cachedPreview := filepath.Join(previewCacheDir, fmt.Sprintf("%s-1.jpg", filepath.Base(filename)))
		if _, err := os.Stat(cachedPreview); err == nil {
			http.ServeFile(w, r, cachedPreview)
			return
		}
		_, err := streamsvc.FFmpegScreenshot(videosDir, previewCacheDir, filepath.Base(filename))
		if err != nil {
			utils.StreamLogs.Error("Failed to generate preview for %s: %v", filename, err)
			http.Error(w, "Error generating preview", http.StatusInternalServerError)
			return
		}
		if _, err := os.Stat(cachedPreview); err == nil {
			http.ServeFile(w, r, cachedPreview)
			return
		}
		http.Error(w, "Preview could not be generated", http.StatusNotFound)
		return
	}

	if len(parts) == 2 && parts[1] == "info" && r.Method == http.MethodGet {
		if _, err := os.Stat(videoPath); err != nil {
			writeStreamJSON(w, http.StatusNotFound, map[string]any{
				"success": false,
				"message": "File not found",
			})
			return
		}
		params, err := streamsvc.GetVideoParams(videoPath)
		if err != nil {
			writeStreamJSON(w, http.StatusInternalServerError, map[string]any{
				"success": false,
				"message": "Failed to extract video parameters",
			})
			return
		}
		writeStreamJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"params":  params,
		})
		return
	}

	w.WriteHeader(http.StatusNotFound)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.Config.RLock()
		resp := map[string]any{
			"guildId":                     s.Config.GuildID,
			"videoChannelId":              s.Config.VideoChannelID,
			"cmdChannelId":                s.Config.CmdChannelID,
			"width":                       s.Config.Width,
			"height":                      s.Config.Height,
			"fps":                         s.Config.FPS,
			"bitrateKbps":                 s.Config.BitrateKbps,
			"maxBitrateKbps":              s.Config.MaxBitrateKbps,
			"videoCodec":                  s.Config.VideoCodec,
			"h26xPreset":                  s.Config.H26xPreset,
			"hardwareAcceleratedDecoding": s.Config.HardwareAcceleratedDecoding,
			"viewerAutoWatch":             s.Config.ViewerAutoWatch,
			"streamLoop":                  s.Config.StreamLoop,
			"serverPort":                  s.Config.ServerPort,
		}
		s.Config.RUnlock()
		writeStreamJSON(w, http.StatusOK, resp)

	case http.MethodPost:
		body := readStreamJSONBody(r)
		envUpdates := make(map[string]string)

		s.Config.Lock()
		if v, ok := body["guildId"]; ok && v != nil {
			s.Config.GuildID = strings.TrimSpace(fmt.Sprintf("%v", v))
			if s.Config.GuildID != "" {
				envUpdates["GUILD_ID"] = s.Config.GuildID
			}
		}
		if v, ok := body["videoChannelId"]; ok && v != nil {
			s.Config.VideoChannelID = strings.TrimSpace(fmt.Sprintf("%v", v))
			if s.Config.VideoChannelID != "" {
				envUpdates["VIDEO_CHANNEL_ID"] = s.Config.VideoChannelID
			}
		}
		if v, ok := body["cmdChannelId"]; ok && v != nil {
			s.Config.CmdChannelID = strings.TrimSpace(fmt.Sprintf("%v", v))
			if s.Config.CmdChannelID != "" {
				envUpdates["COMMAND_CHANNEL_ID"] = s.Config.CmdChannelID
			}
		}
		if v, ok := body["width"].(float64); ok && v > 0 {
			s.Config.Width = int(v)
			envUpdates["STREAM_WIDTH"] = strconv.Itoa(s.Config.Width)
		}
		if v, ok := body["height"].(float64); ok && v > 0 {
			s.Config.Height = int(v)
			envUpdates["STREAM_HEIGHT"] = strconv.Itoa(s.Config.Height)
		}
		if v, ok := body["fps"].(float64); ok && v > 0 {
			s.Config.FPS = int(v)
			envUpdates["STREAM_FPS"] = strconv.Itoa(s.Config.FPS)
		}
		if v, ok := body["bitrateKbps"].(float64); ok && v > 0 {
			s.Config.BitrateKbps = int(v)
			envUpdates["STREAM_BITRATE_KBPS"] = strconv.Itoa(s.Config.BitrateKbps)
		}
		if v, ok := body["maxBitrateKbps"].(float64); ok && v > 0 {
			s.Config.MaxBitrateKbps = int(v)
		}
		if v, ok := body["videoCodec"].(string); ok && v != "" {
			s.Config.VideoCodec = config.ParseVideoCodec(v)
			envUpdates["STREAM_VIDEO_CODEC"] = string(s.Config.VideoCodec)
		}
		if v, ok := body["h26xPreset"].(string); ok && v != "" {
			s.Config.H26xPreset = config.ParsePreset(v)
			envUpdates["STREAM_H26X_PRESET"] = string(s.Config.H26xPreset)
		}
		if v, ok := body["hardwareAcceleratedDecoding"]; ok && v != nil {
			s.Config.HardwareAcceleratedDecoding = config.ParseBoolean(v)
		}
		if v, ok := body["viewerAutoWatch"]; ok && v != nil {
			s.Config.ViewerAutoWatch = config.ParseBoolean(v)
			envUpdates["VIEWER_AUTO_WATCH"] = fmt.Sprintf("%v", s.Config.ViewerAutoWatch)
		}
		var newLoop *bool
		if v, ok := body["streamLoop"]; ok && v != nil {
			b := config.ParseBoolean(v)
			s.Config.StreamLoop = b
			newLoop = &b
			envUpdates["STREAM_LOOP"] = fmt.Sprintf("%v", s.Config.StreamLoop)
		}
		s.Config.Unlock()

		if newLoop != nil {
			s.StreamingService.SetLoop(*newLoop)
		}

		if len(envUpdates) > 0 {
			if err := config.UpdateEnvFile(envUpdates); err == nil {
				utils.StreamLogs.Info(".env updated with new configuration parameters.")
			}
		}

		s.Broadcast(map[string]any{"type": "status", "data": s.GetFullStatus()})
		writeStreamJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Configuration updated successfully",
			"config":  s.Config,
		})

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleConfigTokens(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readStreamJSONBody(r)
	mainToken, _ := body["mainToken"].(string)
	viewerToken, _ := body["viewerToken"].(string)
	mainToken = strings.TrimSpace(mainToken)
	viewerToken = strings.TrimSpace(viewerToken)

	if mainToken == "" || viewerToken == "" {
		writeStreamJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"message": "Treo Stream yêu cầu nhập đủ 2 Token: 1 Token Chính (Streamer) và 1 Token Phụ (Viewer Farm).",
		})
		return
	}

	var guildID, videoChannelID, prefix, cmdChannelID, adminIDsStr string
	hasGuild := false
	hasChan := false
	hasPrefix := false
	hasCmdChan := false
	hasAdmins := false

	if v, ok := body["guildId"]; ok && v != nil {
		guildID = strings.TrimSpace(fmt.Sprintf("%v", v))
		hasGuild = true
	}
	if v, ok := body["videoChannelId"]; ok && v != nil {
		videoChannelID = strings.TrimSpace(fmt.Sprintf("%v", v))
		hasChan = true
	}
	if v, ok := body["prefix"]; ok && v != nil {
		prefix = strings.TrimSpace(fmt.Sprintf("%v", v))
		hasPrefix = true
	}
	if v, ok := body["cmdChannelId"]; ok && v != nil {
		cmdChannelID = strings.TrimSpace(fmt.Sprintf("%v", v))
		hasCmdChan = true
	}
	if v, ok := body["adminIds"]; ok && v != nil {
		adminIDsStr = strings.TrimSpace(fmt.Sprintf("%v", v))
		hasAdmins = true
	}

	s.Config.Lock()
	s.Config.Token = mainToken
	s.Config.ViewerToken = viewerToken
	if hasGuild {
		s.Config.GuildID = guildID
		s.StreamStatus.ChannelInfo.GuildID = guildID
	}
	if hasChan {
		s.Config.VideoChannelID = videoChannelID
		s.StreamStatus.ChannelInfo.ChannelID = videoChannelID
	}
	if hasPrefix {
		s.Config.Prefix = prefix
	}
	if hasCmdChan {
		s.Config.CmdChannelID = cmdChannelID
	}
	if hasAdmins {
		s.Config.AdminIDs = config.ParseAdminIDs(adminIDsStr)
	}
	curPrefix := s.Config.Prefix
	s.Config.Unlock()

	s.connectMainClient(mainToken)
	go s.ViewerService.UpdateTokenAndLogin(viewerToken)

	if s.SubscriptionManager != nil {
		var pGuild, pChan, pPrefix, pCmd, pAdmin *string
		if hasGuild {
			pGuild = &guildID
		}
		if hasChan {
			pChan = &videoChannelID
		}
		if hasPrefix {
			pPrefix = &curPrefix
		}
		if hasCmdChan {
			pCmd = &cmdChannelID
		}
		if hasAdmins {
			pAdmin = &adminIDsStr
		}
		s.SubscriptionManager.UpdateFirstAccountStreamTokens(
			mainToken,
			viewerToken,
			pGuild,
			pChan,
			pPrefix,
			pCmd,
			pAdmin,
		)
	}

	utils.StreamLogs.Info("[StreamBot] Updated 2 Discord tokens (1 Main Streamer + 1 Secondary Viewer) via Dashboard.")
	fullStatus := s.GetFullStatus()
	s.Broadcast(map[string]any{"type": "status", "data": fullStatus})
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Đã cập nhật 2 Token Stream (1 Chính + 1 Phụ) thành công",
		"status":  fullStatus,
	})
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	writeStreamJSON(w, http.StatusOK, map[string]any{
		"logs": utils.StreamLogs.All(),
	})
}

func (s *Server) handleStaticFallback(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api") || strings.HasPrefix(r.URL.Path, "/ws") {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	root := config.ResolveWorkspaceRoot()
	candidates := []string{
		filepath.Join(root, "frontend", "dist"),
		filepath.Join(root, "stream", "dist", "public"),
	}
	for _, distDir := range candidates {
		if info, err := os.Stat(distDir); err == nil && info.IsDir() {
			target := filepath.Join(distDir, filepath.Clean(r.URL.Path))
			if fInfo, err := os.Stat(target); err == nil && !fInfo.IsDir() {
				http.ServeFile(w, r, target)
				return
			}
			indexFile := filepath.Join(distDir, "index.html")
			if _, err := os.Stat(indexFile); err == nil {
				http.ServeFile(w, r, indexFile)
				return
			}
		}
	}
	w.WriteHeader(http.StatusNotFound)
}

func (s *Server) Start() error {
	go func() {
		_ = streamsvc.DownloadYtDlpExecutable()
		streamsvc.CheckForUpdatesAndUpdateYtDlp()
	}()

	go s.ViewerService.Start()

	s.Config.RLock()
	mainTok := s.Config.Token
	port := s.Config.ServerPort
	s.Config.RUnlock()

	if len(strings.TrimSpace(mainTok)) > 10 {
		s.connectMainClient(mainTok)
	} else {
		utils.StreamLogs.Info("Discord token not provided in stream/.env. Running Web API & Standby mode on port %d.", port)
	}

	s.httpServer = &http.Server{
		Addr:              fmt.Sprintf(":%d", port),
		Handler:           s.Handler(),
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-s.stopCh:
				return
			case <-ticker.C:
				s.wsMu.Lock()
				count := len(s.wsClients)
				s.wsMu.Unlock()
				if count > 0 {
					s.Broadcast(map[string]any{
						"type": "status",
						"data": s.GetFullStatus(),
					})
				}
			}
		}
	}()

	utils.StreamLogs.Info("[Web Server] StreamBot & Farm Dashboard API running at: http://localhost:%d", port)
	err := s.httpServer.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
	if s.unsubLogs != nil {
		s.unsubLogs()
	}
	s.StreamingService.CleanupStreamStatus(true)
	s.ViewerService.Close()

	s.mu.Lock()
	if s.mainClient != nil {
		s.mainClient.Close()
		s.mainClient = nil
	}
	s.mu.Unlock()

	s.wsMu.Lock()
	for c := range s.wsClients {
		_ = c.conn.Close()
	}
	s.wsClients = make(map[*wsStreamClient]bool)
	s.wsMu.Unlock()

	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}
