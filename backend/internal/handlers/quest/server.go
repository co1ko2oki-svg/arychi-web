package quest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/database"
	"arychi-web/backend/internal/discord/rest"
	questsvc "arychi-web/backend/internal/services/quest"
	"arychi-web/backend/internal/services/spoofer"
	"arychi-web/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Server struct {
	Port                int
	SubscriptionManager *database.SubscriptionManager
	UserManager         *database.UserManager
	QuestService        *questsvc.QuestService
	httpServer          *http.Server
	startTime           time.Time

	wsMu      sync.Mutex
	wsClients map[*wsClient]bool
	upgrader  websocket.Upgrader
	stopCh    chan struct{}
	unsubLogs func()

	badgeMu   sync.Mutex
	badgeJobs map[string]*BadgeJob
}

type BadgeJob struct {
	ID           string   `json:"id"`
	TokenMasked  string   `json:"tokenMasked"`
	HasCookie    bool     `json:"hasCookie"`
	CookieMasked string   `json:"cookieMasked,omitempty"`
	Mode         string   `json:"mode"`
	TargetHours  int      `json:"targetHours"`
	CurrentHours int      `json:"currentHours"`
	GamesCount   int      `json:"gamesCount"`
	Games        []string `json:"games,omitempty"`
	Status       string   `json:"status"`
	Message      string   `json:"message"`
	StartedAt    int64    `json:"startedAt"`
	UpdatedAt    int64    `json:"updatedAt"`
}

type wsClient struct {
	conn    *websocket.Conn
	sendCh  chan []byte
	isAlive bool
}

func (c *wsClient) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.sendCh:
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second)); err != nil {
				return
			}
		}
	}
}

func (c *wsClient) sendJSON(v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	select {
	case c.sendCh <- raw:
		return nil
	default:
		return fmt.Errorf("client queue full")
	}
}

func (c *wsClient) sendPing() error {
	select {
	case c.sendCh <- []byte(`{"type":"ping"}`):
		return nil
	default:
		return nil
	}
}

func NewServer(
	port int,
	subMgr *database.SubscriptionManager,
	userMgr *database.UserManager,
	questSvc *questsvc.QuestService,
) *Server {
	if port <= 0 {
		port = 3001
	}
	if subMgr == nil {
		subMgr = database.NewSubscriptionManager()
	}
	if userMgr == nil {
		userMgr = database.NewUserManager()
	}
	if questSvc == nil {
		questSvc = questsvc.NewQuestService()
	}

	s := &Server{
		Port:                port,
		SubscriptionManager: subMgr,
		UserManager:         userMgr,
		QuestService:        questSvc,
		startTime:           time.Now(),
		wsClients:           make(map[*wsClient]bool),
		stopCh:              make(chan struct{}),
		badgeJobs:           make(map[string]*BadgeJob),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}

	s.QuestService.OnJobEvent(func(eventType string, job questsvc.QuestJob) {
		s.Broadcast(eventType, job)
	})

	s.unsubLogs = utils.QuestLogs.Subscribe(func(entry utils.LogEntry) {
		s.Broadcast("log", entry)
	})

	return s
}

func (s *Server) Broadcast(msgType string, data any) {
	raw, err := json.Marshal(map[string]any{
		"type": msgType,
		"data": data,
	})
	if err != nil {
		return
	}

	s.wsMu.Lock()
	clients := make([]*wsClient, 0, len(s.wsClients))
	for c := range s.wsClients {
		clients = append(clients, c)
	}
	s.wsMu.Unlock()

	for _, c := range clients {
		select {
		case c.sendCh <- raw:
		default:
			// Non-blocking drop for slow clients to protect backend
		}
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.Handler().ServeHTTP(w, r)
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/ws", s.handleWS)
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/auth/oauth/config", s.handleOAuthConfig)
	mux.HandleFunc("/api/auth/oauth/login", s.handleOAuthLogin)
	mux.HandleFunc("/api/subscription/verify", s.handleSubscriptionVerify)
	mux.HandleFunc("/api/subscription/grant", s.handleSubscriptionGrant)
	mux.HandleFunc("/api/account/tokens", s.handleAccountTokens)
	mux.HandleFunc("/api/auth/verify", s.handleAuthVerify)
	mux.HandleFunc("/api/auth/users", s.handleAuthUsers)
	mux.HandleFunc("/api/auth/users/", s.handleAuthUserDelete)
	mux.HandleFunc("/api/auth/current", s.handleAuthCurrent)
	mux.HandleFunc("/api/auth/switch", s.handleAuthSwitch)
	mux.HandleFunc("/api/quests/list", s.handleQuestsList)
	mux.HandleFunc("/api/quests/start-all", s.handleQuestsStartAll)
	mux.HandleFunc("/api/quests/stop-all", s.handleQuestsStopAll)
	mux.HandleFunc("/api/quests/jobs", s.handleQuestsJobs)
	mux.HandleFunc("/api/quests/", s.handleQuestsDynamic)
	mux.HandleFunc("/api/badges/credentials", s.handleBadgesCredentials)
	mux.HandleFunc("/api/badges/start", s.handleBadgesStart)
	mux.HandleFunc("/api/badges/status", s.handleBadgesStatus)
	mux.HandleFunc("/api/badges/stop", s.handleBadgesStop)
	mux.HandleFunc("/api/logs", s.handleLogs)

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
		w.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Key")

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
			r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10MB request payload limit
		}

		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func readJSONBody(r *http.Request) map[string]any {
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

func extractToken(r *http.Request, body map[string]any) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader != "" {
		return utils.CleanToken(authHeader)
	}
	if tok, ok := body["token"].(string); ok && strings.TrimSpace(tok) != "" {
		return utils.CleanToken(tok)
	}
	for _, envKey := range []string{"DISCORD_QUEST_TOKEN", "TOKEN", "DISCORD_BOT_TOKEN"} {
		if val := strings.TrimSpace(os.Getenv(envKey)); val != "" {
			return utils.CleanToken(val)
		}
	}
	return ""
}

func extractSessionToken(r *http.Request, body map[string]any) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	if q := strings.TrimSpace(r.URL.Query().Get("session")); q != "" {
		return q
	}
	if b, ok := body["sessionToken"].(string); ok && strings.TrimSpace(b) != "" {
		return strings.TrimSpace(b)
	}
	return ""
}

func getAllowedRedirectURIs() []string {
	raw := os.Getenv("DISCORD_REDIRECT_URIS")
	if raw == "" {
		raw = os.Getenv("DISCORD_REDIRECT_URI")
	}
	if raw == "" {
		raw = "https://arychi.xyz"
	}
	var res []string
	for _, part := range strings.Split(raw, ",") {
		trimmed := strings.TrimRight(strings.TrimSpace(part), "/")
		if trimmed != "" {
			res = append(res, trimmed)
		}
	}
	if len(res) == 0 {
		res = []string{"https://arychi.xyz"}
	}
	return res
}

func resolveRedirectURI(candidate string) string {
	allowed := getAllowedRedirectURIs()
	norm := strings.TrimRight(strings.TrimSpace(candidate), "/")
	if norm != "" {
		for _, a := range allowed {
			if a == norm {
				return norm
			}
		}
	}
	return allowed[0]
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &wsClient{
		conn:    conn,
		sendCh:  make(chan []byte, 128),
		isAlive: true,
	}

	s.wsMu.Lock()
	s.wsClients[client] = true
	s.wsMu.Unlock()

	go client.writePump()

	utils.QuestLogs.Info("Client connected to WebSocket server.")

	conn.SetPongHandler(func(string) error {
		s.wsMu.Lock()
		client.isAlive = true
		s.wsMu.Unlock()
		return nil
	})

	initData := map[string]any{
		"jobs": s.QuestService.GetJobs(""),
	}
	sessionParam := r.URL.Query().Get("session")
	if sessionParam != "" {
		if acc := s.SubscriptionManager.GetAccountBySession(sessionParam); acc != nil && s.SubscriptionManager.IsAdmin(acc) {
			initData["logs"] = utils.QuestLogs.Recent(50)
		}
	}

	_ = client.sendJSON(map[string]any{
		"type": "init",
		"data": initData,
	})

	defer func() {
		s.wsMu.Lock()
		delete(s.wsClients, client)
		s.wsMu.Unlock()
		close(client.sendCh)
	}()

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg map[string]any
		if json.Unmarshal(msgBytes, &msg) == nil {
			switch msg["type"] {
			case "ping":
				_ = client.sendJSON(map[string]any{
					"type":      "pong",
					"timestamp": time.Now().UnixMilli(),
				})
			case "get_init":
				_ = client.sendJSON(map[string]any{
					"type": "init",
					"data": map[string]any{
						"logs": utils.QuestLogs.Recent(50),
						"jobs": s.QuestService.GetJobs(""),
					},
				})
			}
		}
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"service":   "Discord Quest Backend",
		"uptime":    time.Since(s.startTime).Seconds(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleOAuthConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	discordClientID := strings.TrimSpace(os.Getenv("DISCORD_CLIENT_ID"))
	discordBotToken := strings.TrimSpace(os.Getenv("DISCORD_BOT_TOKEN"))
	candidate := r.URL.Query().Get("redirectUri")
	if candidate == "" {
		candidate = r.Header.Get("Origin")
	}
	discordRedirectURI := resolveRedirectURI(candidate)

	var botInfo map[string]any
	if discordBotToken != "" {
		httpClient := &http.Client{Timeout: 8 * time.Second}
		req, err := http.NewRequest(http.MethodGet, "https://discord.com/api/v10/users/@me", nil)
		if err == nil {
			req.Header.Set("Authorization", "Bot "+discordBotToken)
			if resp, err := httpClient.Do(req); err == nil {
				defer resp.Body.Close()
				var bData struct {
					ID       string  `json:"id"`
					Username string  `json:"username"`
					Avatar   *string `json:"avatar"`
				}
				if json.NewDecoder(resp.Body).Decode(&bData) == nil && bData.ID != "" {
					var avatarURL any
					if bData.Avatar != nil && *bData.Avatar != "" {
						avatarURL = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", bData.ID, *bData.Avatar)
					}
					botInfo = map[string]any{
						"id":        bData.ID,
						"username":  bData.Username,
						"avatarUrl": avatarURL,
					}
				}
			}
		}
	}

	var clientIDVal any
	var authURLVal any
	var botInviteURLVal any
	if discordClientID != "" {
		clientIDVal = discordClientID
		authURLVal = fmt.Sprintf(
			"https://discord.com/oauth2/authorize?client_id=%s&response_type=code&redirect_uri=%s&scope=identify+guilds+guilds.join+email",
			url.QueryEscape(discordClientID),
			url.QueryEscape(discordRedirectURI),
		)
		botInviteURLVal = fmt.Sprintf(
			"https://discord.com/oauth2/authorize?client_id=%s&permissions=8&scope=bot+applications.commands",
			url.QueryEscape(discordClientID),
		)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"plan": map[string]any{
			"id":   database.PlanID,
			"name": database.PlanName,
		},
		"oauth": map[string]any{
			"discordConfigured":    discordClientID != "" || discordBotToken != "",
			"discordClientId":      clientIDVal,
			"discordBotConfigured": discordBotToken != "",
			"botInfo":              botInfo,
			"discordAuthUrl":       authURLVal,
			"discordBotInviteUrl":  botInviteURLVal,
		},
	})
}

var nonAlphaNumRe = regexp.MustCompile(`[^a-z0-9]`)

func (s *Server) handleOAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	body := readJSONBody(r)
	provider := "discord"
	code, _ := body["code"].(string)
	accessToken, _ := body["accessToken"].(string)

	id := strings.TrimSpace(fmt.Sprintf("%v", body["id"]))
	if body["id"] == nil {
		id = ""
	}
	username := strings.TrimSpace(fmt.Sprintf("%v", body["username"]))
	if body["username"] == nil {
		username = ""
	}
	email := strings.TrimSpace(fmt.Sprintf("%v", body["email"]))
	if body["email"] == nil {
		email = ""
	}
	var avatarURL *string
	if av, ok := body["avatarUrl"].(string); ok && av != "" {
		avatarURL = &av
	}

	clientID := strings.TrimSpace(os.Getenv("DISCORD_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("DISCORD_CLIENT_SECRET"))

	if code != "" && (clientID == "" || clientSecret == "") {
		utils.QuestLogs.Error("[OAuth2] Thiếu DISCORD_CLIENT_ID hoặc DISCORD_CLIENT_SECRET trong .env")
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error": "Máy chủ chưa cấu hình DISCORD_CLIENT_SECRET nên không thể hoàn tất đăng nhập Discord.",
		})
		return
	}

	httpClient := &http.Client{Timeout: 15 * time.Second}

	if code != "" && clientID != "" && clientSecret != "" {
		redirectCandidate, _ := body["redirectUri"].(string)
		redirectURI := resolveRedirectURI(redirectCandidate)

		form := url.Values{}
		form.Set("client_id", clientID)
		form.Set("client_secret", clientSecret)
		form.Set("grant_type", "authorization_code")
		form.Set("code", code)
		form.Set("redirect_uri", redirectURI)

		tokenReq, _ := http.NewRequest(http.MethodPost, "https://discord.com/api/v10/oauth2/token", strings.NewReader(form.Encode()))
		tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		tokenResp, err := httpClient.Do(tokenReq)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error": "Mã xác thực Discord OAuth2 không hợp lệ hoặc đã hết hạn",
			})
			return
		}
		defer tokenResp.Body.Close()

		var tokenData map[string]any
		_ = json.NewDecoder(tokenResp.Body).Decode(&tokenData)
		oauthAccessToken, _ := tokenData["access_token"].(string)
		if oauthAccessToken == "" {
			errDesc, _ := tokenData["error_description"].(string)
			if errDesc == "" {
				errDesc, _ = tokenData["error"].(string)
			}
			if errDesc == "" {
				errDesc = "Mã xác thực Discord OAuth2 không hợp lệ hoặc đã hết hạn"
			}
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": errDesc})
			return
		}

		userReq, _ := http.NewRequest(http.MethodGet, "https://discord.com/api/v10/users/@me", nil)
		userReq.Header.Set("Authorization", "Bearer "+oauthAccessToken)
		userResp, err := httpClient.Do(userReq)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Không thể truy xuất thông tin tài khoản từ Discord API"})
			return
		}
		defer userResp.Body.Close()

		var userData struct {
			ID         string  `json:"id"`
			Username   string  `json:"username"`
			GlobalName string  `json:"global_name"`
			Email      string  `json:"email"`
			Avatar     *string `json:"avatar"`
		}
		_ = json.NewDecoder(userResp.Body).Decode(&userData)
		if userData.ID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Không thể truy xuất thông tin tài khoản từ Discord API"})
			return
		}

		id = userData.ID
		username = userData.GlobalName
		if username == "" {
			username = userData.Username
		}
		email = userData.Email
		if email == "" {
			email = fmt.Sprintf("%s@discord.oauth", userData.Username)
		}
		if userData.Avatar != nil && *userData.Avatar != "" {
			av := fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", id, *userData.Avatar)
			avatarURL = &av
		}

		botToken := strings.TrimSpace(os.Getenv("DISCORD_BOT_TOKEN"))
		guildID := strings.TrimSpace(os.Getenv("GUILD_ID"))
		if botToken != "" && guildID != "" {
			joinBody, _ := json.Marshal(map[string]string{"access_token": oauthAccessToken})
			joinReq, err := http.NewRequest(
				http.MethodPut,
				fmt.Sprintf("https://discord.com/api/v10/guilds/%s/members/%s", guildID, id),
				bytes.NewReader(joinBody),
			)
			if err == nil {
				joinReq.Header.Set("Authorization", "Bot "+botToken)
				joinReq.Header.Set("Content-Type", "application/json")
				if joinResp, err := httpClient.Do(joinReq); err == nil {
					_ = joinResp.Body.Close()
					utils.QuestLogs.Info("[Bot OAuth2] Đã kết nạp user @%s (%s) vào Guild %s qua Bot Token", username, id, guildID)
				} else {
					utils.QuestLogs.Warn("[Bot OAuth2] Không thể tự động thêm user vào server: %v", err)
				}
			}
		}
	} else if accessToken != "" {
		userReq, _ := http.NewRequest(http.MethodGet, "https://discord.com/api/v10/users/@me", nil)
		userReq.Header.Set("Authorization", accessToken)
		userResp, err := httpClient.Do(userReq)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token tài khoản Discord không hợp lệ hoặc đã hết hạn"})
			return
		}
		defer userResp.Body.Close()

		var userData struct {
			ID         string  `json:"id"`
			Username   string  `json:"username"`
			GlobalName string  `json:"global_name"`
			Email      string  `json:"email"`
			Avatar     *string `json:"avatar"`
		}
		_ = json.NewDecoder(userResp.Body).Decode(&userData)
		if userData.ID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token tài khoản Discord không hợp lệ hoặc đã hết hạn"})
			return
		}
		id = userData.ID
		username = userData.GlobalName
		if username == "" {
			username = userData.Username
		}
		email = userData.Email
		if email == "" {
			email = fmt.Sprintf("%s@discord.oauth", userData.Username)
		}
		if userData.Avatar != nil && *userData.Avatar != "" {
			av := fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", id, *userData.Avatar)
			avatarURL = &av
		}
	}

	if username == "" && email != "" {
		username = strings.Split(email, "@")[0]
	}
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Vui lòng nhập tên tài khoản hoặc email hợp lệ"})
		return
	}
	if id == "" {
		sourceSlug := email
		if sourceSlug == "" {
			sourceSlug = username
		}
		cleanSlug := nonAlphaNumRe.ReplaceAllString(strings.ToLower(sourceSlug), "")
		id = "dc_" + cleanSlug
	}
	if email == "" {
		email = fmt.Sprintf("%s@%s.oauth", username, provider)
	}

	account := s.SubscriptionManager.UpsertOAuthAccount(database.UpsertOAuthInput{
		ID:        id,
		Provider:  provider,
		Username:  username,
		Email:     email,
		AvatarURL: avatarURL,
		Token:     accessToken,
	})
	sub := s.SubscriptionManager.ComputeSubscriptionStatus(&account)
	utils.QuestLogs.Success("[OAuth2] User @%s (%s) authenticated and linked with Bot.", account.Username, strings.ToUpper(account.Provider))

	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"sessionToken": account.SessionToken,
		"account":      account,
		"subscription": sub,
	})
}

func (s *Server) handleSubscriptionVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	sessionToken := extractSessionToken(r, nil)
	account := s.SubscriptionManager.GetAccountBySession(sessionToken)
	if account == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"verified":      false,
			"authenticated": false,
			"hasActivePlan": false,
			"daysRemaining": 0,
			"domainTarget":  "dash.arychi.xyz",
			"account":       nil,
			"subscription":  nil,
		})
		return
	}

	sub := s.SubscriptionManager.ComputeSubscriptionStatus(account)
	hasActive := sub != nil && sub.IsActive
	daysRem := 0
	if sub != nil {
		daysRem = sub.DaysRemaining
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"verified":      hasActive,
		"authenticated": true,
		"hasActivePlan": hasActive,
		"daysRemaining": daysRem,
		"domainTarget":  "dash.arychi.xyz",
		"account":       account,
		"subscription":  sub,
	})
}

func (s *Server) handleSubscriptionGrant(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	callerSession := extractSessionToken(r, nil)
	caller := s.SubscriptionManager.GetAccountBySession(callerSession)
	adminKey := r.Header.Get("X-Admin-Key")
	configuredKey := strings.TrimSpace(os.Getenv("ADMIN_KEY"))

	isAdmin := false
	if configuredKey != "" && adminKey == configuredKey {
		isAdmin = true
	} else if caller != nil && s.SubscriptionManager.IsAdmin(caller) {
		isAdmin = true
	}

	if !isAdmin {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error": "Truy cập bị từ chối: Chỉ quản trị viên (Admin) mới có quyền cấp thời hạn gói.",
		})
		return
	}

	body := readJSONBody(r)
	userID := ""
	if body["userId"] != nil {
		userID = strings.TrimSpace(fmt.Sprintf("%v", body["userId"]))
	}
	if userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Missing userId"})
		return
	}

	months := 12
	if mVal, ok := body["months"].(float64); ok && int(mVal) >= 1 {
		months = int(mVal)
	} else if mStr, ok := body["months"].(string); ok {
		if parsed, err := strconv.Atoi(mStr); err == nil && parsed >= 1 {
			months = parsed
		}
	}

	customKey := ""
	if lk, ok := body["licenseKey"].(string); ok {
		customKey = strings.TrimSpace(lk)
	}

	res := s.SubscriptionManager.GrantSubscription(userID, months, customKey)
	if res == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{
			"error": "Tài khoản không tồn tại hoặc phiên đăng nhập không hợp lệ",
		})
		return
	}

	utils.QuestLogs.Success("[VIP Grant] Đã cấp quyền truy cập (+%d tháng) cho tài khoản @%s (ID: %s)", months, res.Account.Username, userID)
	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"account":      res.Account,
		"subscription": res.Subscription,
	})
}

func (s *Server) handleAccountTokens(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	sessionToken := extractSessionToken(r, body)
	account := s.SubscriptionManager.GetAccountBySession(sessionToken)
	if account == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error": "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
		})
		return
	}

	var update database.AccountTokensUpdate
	var questTokenVal string
	if v, ok := body["questToken"].(string); ok {
		update.QuestToken = &v
		questTokenVal = strings.TrimSpace(v)
	}
	if v, ok := body["streamMainToken"].(string); ok {
		update.StreamMainToken = &v
	}
	if v, ok := body["streamViewerToken"].(string); ok {
		update.StreamViewerToken = &v
	}
	if v, ok := body["streamGuildId"].(string); ok {
		update.StreamGuildID = &v
	}
	if v, ok := body["streamChannelId"].(string); ok {
		update.StreamChannelID = &v
	}
	if v, ok := body["prefix"].(string); ok {
		update.Prefix = &v
	}
	if v, ok := body["commandChannelId"].(string); ok {
		update.CommandChannelID = &v
	}
	if v, ok := body["adminIds"].(string); ok {
		update.AdminIDs = &v
	}

	var verifiedDiscordUser *rest.VerifiedUser
	if questTokenVal != "" {
		check := s.QuestService.VerifyToken(r.Context(), questTokenVal, "")
		if !check.Valid || check.User == nil {
			errMsg := check.Error
			if errMsg == "" {
				errMsg = "Token tài khoản Discord (Quest/Giờ chơi) không hợp lệ hoặc đã hết hạn."
			}
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": errMsg})
			return
		}
		verifiedDiscordUser = check.User
	}

	updated := s.SubscriptionManager.UpdateAccountTokens(account.ID, update)

	if (update.StreamMainToken != nil && *update.StreamMainToken != "") ||
		(update.StreamViewerToken != nil && *update.StreamViewerToken != "") {
		go func() {
			forwardPayload, _ := json.Marshal(map[string]any{
				"mainToken":      body["streamMainToken"],
				"viewerToken":    body["streamViewerToken"],
				"guildId":        body["streamGuildId"],
				"videoChannelId": body["streamChannelId"],
				"prefix":         body["prefix"],
				"cmdChannelId":   body["commandChannelId"],
				"adminIds":       body["adminIds"],
			})
			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Post("http://localhost:3000/api/config/tokens", "application/json", bytes.NewReader(forwardPayload))
			if err == nil {
				_ = resp.Body.Close()
			}
		}()
	}

	utils.QuestLogs.Info("Đã lưu cấu hình Token thành công cho tài khoản @%s.", account.Username)
	writeJSON(w, http.StatusOK, map[string]any{
		"success":             true,
		"account":             updated,
		"verifiedDiscordUser": verifiedDiscordUser,
		"subscription":        s.SubscriptionManager.ComputeSubscriptionStatus(updated),
	})
}

func (s *Server) handleAuthVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	token := extractToken(r, body)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token is required"})
		return
	}

	preferredType, _ := body["type"].(string)
	saveToData := true
	if sVal, ok := body["saveToData"].(bool); ok {
		saveToData = sVal
	}

	result := s.QuestService.VerifyToken(r.Context(), token, preferredType)
	if !result.Valid || result.User == nil {
		writeJSON(w, http.StatusUnauthorized, result)
		return
	}

	var savedUser *database.StoredUser
	if saveToData {
		accType := result.User.Type
		if accType == "" {
			if result.User.Bot {
				accType = "bot"
			} else {
				accType = "user"
			}
		}
		saved := s.UserManager.SaveUser(database.SaveUserInput{
			ID:            result.User.ID,
			Username:      result.User.Username,
			Discriminator: result.User.Discriminator,
			AvatarURL:     result.User.AvatarURL,
			Email:         result.User.Email,
			Token:         token,
			Type:          accType,
			Bot:           result.User.Bot,
		})
		savedUser = &saved
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"valid":     true,
		"user":      result.User,
		"savedUser": savedUser,
	})
}

func (s *Server) handleAuthUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	users := s.UserManager.GetAllUsers()
	active := s.UserManager.GetActiveUser()
	var activeID any
	if active != nil {
		activeID = active.ID
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users":        users,
		"activeUserId": activeID,
	})
}

func (s *Server) handleAuthUserDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/auth/users/")
	ok := s.UserManager.DeleteUser(id)
	writeJSON(w, http.StatusOK, map[string]any{"success": ok})
}

func (s *Server) handleAuthCurrent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	active := s.UserManager.GetActiveUser()
	writeJSON(w, http.StatusOK, map[string]any{"user": active})
}

func (s *Server) handleAuthSwitch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	id, _ := body["id"].(string)
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "User ID is required"})
		return
	}
	user := s.UserManager.SetActiveUser(id)
	if user == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "User not found in database"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "user": user})
}

func (s *Server) handleQuestsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	token := extractToken(r, body)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token is required"})
		return
	}
	data, err := s.QuestService.FetchQuests(r.Context(), token)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (s *Server) handleQuestsStartAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	token := extractToken(r, body)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token is required"})
		return
	}
	jobs, err := s.QuestService.StartAllQuests(r.Context(), token)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"startedCount": len(jobs),
		"jobs":         jobs,
	})
}

func (s *Server) handleQuestsStopAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	token := extractToken(r, body)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token is required"})
		return
	}
	stoppedCount := s.QuestService.StopAllQuests(token)
	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"stoppedCount": stoppedCount,
	})
}

func (s *Server) handleQuestsJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	jobs := s.QuestService.GetJobs(token)
	writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs})
}

func (s *Server) handleQuestsDynamic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	sub := strings.TrimPrefix(r.URL.Path, "/api/quests/")
	parts := strings.Split(strings.Trim(sub, "/"), "/")
	if len(parts) != 2 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	questID := parts[0]
	action := parts[1]

	body := readJSONBody(r)
	token := extractToken(r, body)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token is required"})
		return
	}

	switch action {
	case "enroll":
		dto, err := s.QuestService.EnrollQuest(r.Context(), token, questID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "quest": dto})
	case "start":
		job, err := s.QuestService.StartQuest(r.Context(), token, questID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "job": job})
	case "stop":
		stopped := s.QuestService.StopQuest(token, questID)
		writeJSON(w, http.StatusOK, map[string]any{"success": stopped})
	case "claim":
		if err := s.QuestService.ClaimQuestReward(r.Context(), token, questID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Reward claim requested"})
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	callerSession := extractSessionToken(r, nil)
	caller := s.SubscriptionManager.GetAccountBySession(callerSession)
	adminKey := r.Header.Get("X-Admin-Key")
	configuredKey := strings.TrimSpace(os.Getenv("ADMIN_KEY"))

	isAdmin := false
	if configuredKey != "" && adminKey == configuredKey {
		isAdmin = true
	} else if caller != nil && s.SubscriptionManager.IsAdmin(caller) {
		isAdmin = true
	}

	if !isAdmin {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error": "Truy cập bị từ chối: Nhật ký hệ thống chỉ dành cho Quản trị viên (Admin).",
			"logs":  []any{},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"logs": utils.QuestLogs.All(),
	})
}

func (s *Server) handleBadgesCredentials(w http.ResponseWriter, r *http.Request) {
	callerSession := extractSessionToken(r, nil)
	var userQuestToken string
	if callerSession != "" {
		caller := s.SubscriptionManager.GetAccountBySession(callerSession)
		if caller != nil {
			userQuestToken = caller.Tokens.QuestToken
		}
	}

	st := spoofer.LoadState()
	if r.Method == http.MethodGet {
		hasTok := userQuestToken != ""
		tokenMasked := ""
		if hasTok {
			tokenMasked = utils.MaskToken(userQuestToken)
		}
		cookieMasked := ""
		if st.HasCookie() {
			cookieMasked = utils.MaskToken(st.Cookie)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"hasToken":     hasTok,
			"hasCookie":    st.HasCookie(),
			"tokenMasked":  tokenMasked,
			"cookieMasked": cookieMasked,
		})
		return
	}

	if r.Method == http.MethodPost {
		body := readJSONBody(r)
		updated := false
		if tok, ok := body["token"].(string); ok && strings.TrimSpace(tok) != "" {
			cleanTok := utils.CleanToken(tok)
			st.Token = cleanTok
			updated = true
			if callerSession != "" {
				caller := s.SubscriptionManager.GetAccountBySession(callerSession)
				if caller != nil {
					s.SubscriptionManager.UpdateAccountTokens(caller.ID, database.TokenUpdateInput{
						QuestToken: &cleanTok,
					})
				}
			}
		}
		if cook, ok := body["cookie"].(string); ok && strings.TrimSpace(cook) != "" {
			st.Cookie = strings.TrimSpace(cook)
			updated = true
		}
		if updated {
			_ = st.Save()
		}
		hasTok := st.HasToken()
		writeJSON(w, http.StatusOK, map[string]any{
			"success":      true,
			"hasToken":     hasTok,
			"hasCookie":    st.HasCookie(),
			"tokenMasked":  utils.MaskToken(st.Token),
			"cookieMasked": utils.MaskToken(st.Cookie),
		})
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (s *Server) handleBadgesStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)

	token := ""
	if t, ok := body["token"].(string); ok && strings.TrimSpace(t) != "" {
		token = utils.CleanToken(t)
	}
	if token == "" {
		callerSession := extractSessionToken(r, body)
		if callerSession != "" {
			caller := s.SubscriptionManager.GetAccountBySession(callerSession)
			if caller != nil && strings.TrimSpace(caller.Tokens.QuestToken) != "" {
				token = caller.Tokens.QuestToken
			}
		}
	}
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error": "Vui lòng nhập Token Discord của tài khoản bạn muốn cày giờ trước khi chạy.",
		})
		return
	}

	st := spoofer.LoadState()
	cookie := ""
	if c, ok := body["cookie"].(string); ok && strings.TrimSpace(c) != "" {
		cookie = strings.TrimSpace(c)
	} else if st.HasCookie() {
		cookie = st.Cookie
	}

	// Save latest state
	st.Token = token
	if cookie != "" {
		st.Cookie = cookie
	}
	_ = st.Save()

	mode := "playtime"
	if m, ok := body["mode"].(string); ok && m != "" {
		mode = m
	}

	targetHours := 100
	if h, ok := body["hours"].(float64); ok && h > 0 {
		targetHours = int(h)
	} else if hStr, ok := body["hours"].(string); ok {
		if parsed, err := strconv.Atoi(hStr); err == nil && parsed > 0 {
			targetHours = parsed
		}
	}
	if targetHours > 5000 {
		targetHours = 5000
	}

	tokenMasked := utils.MaskToken(token)
	cookieMasked := ""
	if cookie != "" {
		cookieMasked = utils.MaskToken(cookie)
	}
	now := time.Now().UnixMilli()
	gamesCount := 1000

	msg := fmt.Sprintf("Đang cày %d giờ chơi cho toàn bộ 1.000+ tựa game...", targetHours)
	if mode == "played" {
		msg = "Đang đánh dấu toàn bộ 1.000+ tựa game là đã chơi..."
	} else if mode == "both" {
		msg = fmt.Sprintf("Đang chạy combo cày %d giờ và đánh dấu 1.000+ game...", targetHours)
	}

	s.badgeMu.Lock()
	job := &BadgeJob{
		ID:           uuid.New().String(),
		TokenMasked:  tokenMasked,
		HasCookie:    cookie != "",
		CookieMasked: cookieMasked,
		Mode:         mode,
		TargetHours:  targetHours,
		CurrentHours: 1,
		GamesCount:   gamesCount,
		Status:       "running",
		Message:      msg,
		StartedAt:    now,
		UpdatedAt:    now,
	}
	s.badgeJobs[tokenMasked] = job
	s.badgeMu.Unlock()

	utils.QuestLogs.Info("Kích hoạt %s cho %s (1.000+ game)", mode, tokenMasked)

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": msg,
		"job":     job,
	})
}

func (s *Server) handleBadgesStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		callerSession := extractSessionToken(r, nil)
		if callerSession != "" {
			caller := s.SubscriptionManager.GetAccountBySession(callerSession)
			if caller != nil && strings.TrimSpace(caller.Tokens.QuestToken) != "" {
				token = caller.Tokens.QuestToken
			}
		}
	}
	if token == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"running": false,
			"job":     nil,
		})
		return
	}
	tokenMasked := utils.MaskToken(token)

	s.badgeMu.Lock()
	defer s.badgeMu.Unlock()

	job, exists := s.badgeJobs[tokenMasked]
	if !exists || job == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"running": false,
			"job":     nil,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"running": job.Status == "running",
		"job":     job,
	})
}

func (s *Server) handleBadgesStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	body := readJSONBody(r)
	token := extractToken(r, body)
	tokenMasked := utils.MaskToken(token)

	s.badgeMu.Lock()
	job, exists := s.badgeJobs[tokenMasked]
	if exists && job != nil {
		job.Status = "paused"
		job.Message = "Đã tạm dừng tiến trình cày giờ chơi"
		job.UpdatedAt = time.Now().UnixMilli()
	}
	s.badgeMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"job":     job,
	})
}

func (s *Server) Start() error {
	s.httpServer = &http.Server{
		Addr:              fmt.Sprintf(":%d", s.Port),
		Handler:           s.Handler(),
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB header limit
	}

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-s.stopCh:
				return
			case <-ticker.C:
				s.wsMu.Lock()
				for c := range s.wsClients {
					if !c.isAlive {
						_ = c.conn.Close()
						delete(s.wsClients, c)
						continue
					}
					c.isAlive = false
					_ = c.sendPing()
				}
				s.wsMu.Unlock()
			}
		}
	}()

	utils.QuestLogs.Info("=====================================================")
	utils.QuestLogs.Info(" Discord Quest Backend Server running on port %d", s.Port)
	utils.QuestLogs.Info(" REST API:   http://localhost:%d/api", s.Port)
	utils.QuestLogs.Info(" WebSocket:  ws://localhost:%d/ws", s.Port)
	utils.QuestLogs.Info("=====================================================")

	go rest.UpdateLatestBuildVersion(false)

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
	stopped := s.QuestService.StopAllRunningJobsGlobally()
	utils.QuestLogs.Info("Stopped %d running jobs cleanly.", stopped)

	s.wsMu.Lock()
	for c := range s.wsClients {
		_ = c.conn.Close()
	}
	s.wsClients = make(map[*wsClient]bool)
	s.wsMu.Unlock()

	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}
