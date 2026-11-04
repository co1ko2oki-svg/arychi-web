package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/discord/reconnect"
	"arychi-web/backend/internal/discord/rest"
	"arychi-web/backend/internal/discord/sessions"
	"arychi-web/backend/internal/utils"
	"github.com/gorilla/websocket"
)

const DefaultGatewayURL = "wss://gateway.discord.gg/?v=10&encoding=json"

type ConnectionState string

const (
	StateDisconnected ConnectionState = "DISCONNECTED"
	StateConnecting   ConnectionState = "CONNECTING"
	StateIdentifying  ConnectionState = "IDENTIFYING"
	StateResuming     ConnectionState = "RESUMING"
	StateReady        ConnectionState = "READY"
	StateReconnecting ConnectionState = "RECONNECTING"
	StateClosing      ConnectionState = "CLOSING"
	StateClosed       ConnectionState = "CLOSED"
)

type GatewayMetrics struct {
	TotalConnects          int64           `json:"totalConnects"`
	TotalReconnects        int64           `json:"totalReconnects"`
	TotalIdentifies        int64           `json:"totalIdentifies"`
	IdentifiesSent         int64           `json:"identifiesSent"`
	TotalResumes           int64           `json:"totalResumes"`
	HeartbeatsSent         int64           `json:"heartbeatsSent"`
	HeartbeatsACKed        int64           `json:"heartbeatsAcked"`
	HeartbeatACKs          int64           `json:"heartbeatAcks"`
	LastRTTMs              int64           `json:"lastRttMs"`
	EventsDispatched       int64           `json:"eventsDispatched"`
	DuplicateEventsDropped int64           `json:"duplicateEventsDropped"`
	CurrentState           ConnectionState `json:"currentState"`
}

type DispatchHandler func(eventType string, raw json.RawMessage)
type ReadyHandler func(data *events.ReadyData)
type MessageCreateHandler func(msg events.MessageCreateEvent)
type VoiceStateUpdateHandler func(oldState *events.VoiceStateEvent, newState events.VoiceStateEvent)
type VoiceServerUpdateHandler func(data events.VoiceServerUpdateEvent)
type StreamCreateHandler func(data events.StreamCreateEvent)
type StreamServerUpdateHandler func(data events.StreamServerUpdateEvent)

type Client struct {
	mu      sync.RWMutex
	writeMu sync.Mutex

	token       string
	gatewayURL  string
	state       ConnectionState
	conn        *websocket.Conn
	session     *sessions.SessionState
	limiter     *sessions.IdentifyLimiter
	dedup       *sessions.EventDeduplicator
	backoff     *reconnect.Backoff
	restClient  *rest.Client
	customProps map[string]interface{}

	ctx        context.Context
	cancel     context.CancelFunc
	connCancel context.CancelFunc
	wg         sync.WaitGroup

	lastHeartbeatSent atomic.Int64
	lastHeartbeatACK  atomic.Int64
	awaitingACK       atomic.Bool
	pingMs            atomic.Int64

	totalConnects          atomic.Int64
	totalReconnects        atomic.Int64
	totalIdentifies        atomic.Int64
	totalResumes           atomic.Int64
	heartbeatsSent         atomic.Int64
	heartbeatsACKed        atomic.Int64
	eventsDispatched       atomic.Int64
	duplicateEventsDropped atomic.Int64

	onDispatch           []DispatchHandler
	onReady              []ReadyHandler
	onMessageCreate      []MessageCreateHandler
	onVoiceStateUpdate   []VoiceStateUpdateHandler
	onVoiceServerUpdate  []VoiceServerUpdateHandler
	onStreamCreate       []StreamCreateHandler
	onStreamServerUpdate []StreamServerUpdateHandler

	readyOnceCh chan struct{}
	readySignaled atomic.Bool
	logger        *utils.LogHub
}

type Options struct {
	Token             string
	GatewayURL        string
	MaxReconnectTries int
	MinBackoff        time.Duration
	MaxBackoff        time.Duration
	Logger            *utils.LogHub
}

type ClientOptions = Options

func NewClient(opts Options) *Client {
	cleanToken := utils.CleanToken(opts.Token)
	gwURL := opts.GatewayURL
	if gwURL == "" {
		gwURL = DefaultGatewayURL
	}
	minBackoff := opts.MinBackoff
	if minBackoff <= 0 {
		minBackoff = 1 * time.Second
	}
	maxBackoff := opts.MaxBackoff
	if maxBackoff <= 0 {
		maxBackoff = 60 * time.Second
	}

	logger := opts.Logger
	if logger == nil {
		logger = utils.StreamLogs
	}

	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		token:       cleanToken,
		gatewayURL:  gwURL,
		state:       StateDisconnected,
		session:     sessions.NewSessionState(),
		limiter:     sessions.NewIdentifyLimiter(),
		dedup:       sessions.NewEventDeduplicator(512),
		backoff:     reconnect.NewBackoff(minBackoff, maxBackoff, opts.MaxReconnectTries),
		restClient:  rest.NewClient(opts.Token),
		customProps: rest.CreateDesktopProperties(),
		logger:      logger,
		ctx:         ctx,
		cancel:      cancel,
		readyOnceCh: make(chan struct{}),
	}
	c.pingMs.Store(-1)
	return c
}

func (c *Client) REST() *rest.Client {
	return c.restClient
}

func (c *Client) Session() *sessions.SessionState {
	return c.session
}

func (c *Client) User() *events.UserPayload {
	return c.session.SelfUser()
}

func (c *Client) IsReady() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state == StateReady && c.session.SelfUser() != nil
}

func (c *Client) Ping() int64 {
	return c.pingMs.Load()
}

func (c *Client) State() ConnectionState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

func (c *Client) setState(st ConnectionState) {
	c.mu.Lock()
	c.state = st
	c.mu.Unlock()
}

func (c *Client) Metrics() GatewayMetrics {
	return GatewayMetrics{
		TotalConnects:          c.totalConnects.Load(),
		TotalReconnects:        c.totalReconnects.Load(),
		TotalIdentifies:        c.totalIdentifies.Load(),
		IdentifiesSent:         c.totalIdentifies.Load(),
		TotalResumes:           c.totalResumes.Load(),
		HeartbeatsSent:         c.heartbeatsSent.Load(),
		HeartbeatsACKed:        c.heartbeatsACKed.Load(),
		HeartbeatACKs:          c.heartbeatsACKed.Load(),
		LastRTTMs:              c.pingMs.Load(),
		EventsDispatched:       c.eventsDispatched.Load(),
		DuplicateEventsDropped: c.duplicateEventsDropped.Load(),
		CurrentState:           c.State(),
	}
}

func (c *Client) GetMetrics() GatewayMetrics {
	return c.Metrics()
}

func (c *Client) OnDispatch(fn DispatchHandler) {
	c.mu.Lock()
	c.onDispatch = append(c.onDispatch, fn)
	c.mu.Unlock()
}

func (c *Client) OnReady(fn ReadyHandler) {
	c.mu.Lock()
	c.onReady = append(c.onReady, fn)
	c.mu.Unlock()
}

func (c *Client) OnMessageCreate(fn MessageCreateHandler) {
	c.mu.Lock()
	c.onMessageCreate = append(c.onMessageCreate, fn)
	c.mu.Unlock()
}

func (c *Client) OnVoiceStateUpdate(fn VoiceStateUpdateHandler) {
	c.mu.Lock()
	c.onVoiceStateUpdate = append(c.onVoiceStateUpdate, fn)
	c.mu.Unlock()
}

func (c *Client) OnVoiceServerUpdate(fn VoiceServerUpdateHandler) {
	c.mu.Lock()
	c.onVoiceServerUpdate = append(c.onVoiceServerUpdate, fn)
	c.mu.Unlock()
}

func (c *Client) OnStreamCreate(fn StreamCreateHandler) {
	c.mu.Lock()
	c.onStreamCreate = append(c.onStreamCreate, fn)
	c.mu.Unlock()
}

func (c *Client) OnStreamServerUpdate(fn StreamServerUpdateHandler) {
	c.mu.Lock()
	c.onStreamServerUpdate = append(c.onStreamServerUpdate, fn)
	c.mu.Unlock()
}

func (c *Client) Connect(ctx ...context.Context) error {
	if c.token == "" {
		return fmt.Errorf("discord token is empty")
	}

	c.wg.Add(1)
	go c.runLoop()

	var doneCtx <-chan struct{}
	if len(ctx) > 0 && ctx[0] != nil {
		doneCtx = ctx[0].Done()
	}

	select {
	case <-c.readyOnceCh:
		return nil
	case <-doneCtx:
		if len(ctx) > 0 && ctx[0] != nil {
			return ctx[0].Err()
		}
		return nil
	case <-c.ctx.Done():
		return fmt.Errorf("gateway closed before ready")
	}
}

func (c *Client) StartAsync() {
	if c.token == "" {
		return
	}
	c.wg.Add(1)
	go c.runLoop()
}

func (c *Client) Close() error {
	c.setState(StateClosing)
	c.cancel()

	c.mu.Lock()
	if c.connCancel != nil {
		c.connCancel()
	}
	conn := c.conn
	c.conn = nil
	c.mu.Unlock()

	if conn != nil {
		c.writeMu.Lock()
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(2*time.Second))
		_ = conn.Close()
		c.writeMu.Unlock()
	}

	c.wg.Wait()
	c.setState(StateClosed)
	return nil
}

func (c *Client) runLoop() {
	defer c.wg.Done()

	for {
		if c.ctx.Err() != nil {
			return
		}

		shouldReconnect, clearSession := c.connectAndServeOnce()
		if c.ctx.Err() != nil || !shouldReconnect {
			return
		}

		if clearSession {
			c.session.ClearSession()
		}

		c.setState(StateReconnecting)
		c.totalReconnects.Add(1)

		delay, ok := c.backoff.NextDelay()
		if !ok {
			utils.AddStreamLog("error", "[Gateway] Maximum reconnect attempts reached. Stopping gateway loop.")
			return
		}

		select {
		case <-c.ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}

func (c *Client) resolveConnectURL() string {
	if c.session.CanResume() {
		_, resumeURL, _, _ := c.session.GetSessionInfo()
		if resumeURL != "" {
			if !strings.Contains(resumeURL, "?") {
				return strings.TrimRight(resumeURL, "/") + "/?v=10&encoding=json"
			}
			return resumeURL
		}
	}
	return c.gatewayURL
}

func (c *Client) connectAndServeOnce() (shouldReconnect bool, clearSession bool) {
	c.setState(StateConnecting)
	targetURL := c.resolveConnectURL()

	dialer := websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
		Proxy:            http.ProxyFromEnvironment,
	}
	headers := http.Header{}
	headers.Set("User-Agent", rest.DesktopUserAgent)

	conn, _, err := dialer.DialContext(c.ctx, targetURL, headers)
	if err != nil {
		return true, false
	}
	conn.SetReadLimit(16 * 1024 * 1024)

	connCtx, connCancel := context.WithCancel(c.ctx)
	c.mu.Lock()
	c.conn = conn
	c.connCancel = connCancel
	c.mu.Unlock()

	c.totalConnects.Add(1)
	c.awaitingACK.Store(false)

	defer func() {
		connCancel()
		c.mu.Lock()
		if c.conn == conn {
			c.conn = nil
		}
		c.mu.Unlock()
		_ = conn.Close()
	}()

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			if c.ctx.Err() != nil {
				return false, false
			}
			if closeErr, ok := err.(*websocket.CloseError); ok {
				action := reconnect.ClassifyGatewayCloseCode(closeErr.Code)
				if !action.CanReconnect {
					utils.AddStreamLog("error", fmt.Sprintf("[Gateway] Non-recoverable close code %d (%s). Halting.", closeErr.Code, action.Reason))
					c.cancel()
					return false, true
				}
				return true, action.ShouldClearSession
			}
			return true, false
		}

		var payload events.GatewayPayload
		if err := json.Unmarshal(msgBytes, &payload); err != nil {
			continue
		}

		if payload.S != nil {
			c.session.UpdateSequence(*payload.S)
		}

		switch payload.Op {
		case events.OpHello:
			var hello events.HelloData
			if err := json.Unmarshal(payload.D, &hello); err == nil && hello.HeartbeatInterval > 0 {
				go c.heartbeatLoop(connCtx, time.Duration(hello.HeartbeatInterval)*time.Millisecond)
			}
			if c.session.CanResume() {
				if err := c.sendResume(); err != nil {
					return true, false
				}
			} else {
				if err := c.sendIdentify(connCtx); err != nil {
					return true, false
				}
			}

		case events.OpHeartbeat:
			_ = c.sendHeartbeat()

		case events.OpHeartbeatACK:
			now := time.Now().UnixMilli()
			c.lastHeartbeatACK.Store(now)
			c.awaitingACK.Store(false)
			c.heartbeatsACKed.Add(1)
			sent := c.lastHeartbeatSent.Load()
			if sent > 0 && now >= sent {
				c.pingMs.Store(now - sent)
			}

		case events.OpReconnect:
			return true, false

		case events.OpInvalidSession:
			var resumable bool
			_ = json.Unmarshal(payload.D, &resumable)
			if !resumable {
				c.session.ClearSession()
				wait := reconnect.RandomInvalidSessionDelay()
				select {
				case <-connCtx.Done():
					return false, true
				case <-time.After(wait):
				}
				if err := c.sendIdentify(connCtx); err != nil {
					return true, true
				}
			} else {
				if err := c.sendResume(); err != nil {
					return true, false
				}
			}

		case events.OpDispatch:
			c.handleDispatch(payload)
		}
	}
}

func (c *Client) heartbeatLoop(ctx context.Context, interval time.Duration) {
	initialWait := reconnect.InitialHeartbeatJitter(interval)
	select {
	case <-ctx.Done():
		return
	case <-time.After(initialWait):
		if err := c.sendHeartbeat(); err != nil {
			return
		}
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if c.awaitingACK.Load() {
				utils.AddStreamLog("warn", "[Gateway] Missed Heartbeat ACK (zombied connection). Reconnecting to resume session...")
				c.mu.RLock()
				conn := c.conn
				c.mu.RUnlock()
				if conn != nil {
					_ = conn.Close()
				}
				return
			}
			if err := c.sendHeartbeat(); err != nil {
				return
			}
		}
	}
}

func (c *Client) sendHeartbeat() error {
	c.lastHeartbeatSent.Store(time.Now().UnixMilli())
	c.awaitingACK.Store(true)
	c.heartbeatsSent.Add(1)
	return c.SendOpcode(events.OpHeartbeat, c.session.SequencePtr())
}

func (c *Client) sendIdentify(ctx context.Context) error {
	if err := c.limiter.Wait(ctx); err != nil {
		return err
	}
	c.setState(StateIdentifying)
	c.totalIdentifies.Add(1)

	props := make(map[string]interface{}, len(c.customProps)+2)
	for k, v := range c.customProps {
		props[k] = v
	}
	props["client_build_number"] = rest.GetClientBuildNumber()
	props["is_fast_connect"] = false
	props["gateway_connect_reasons"] = "AppSkeleton"

	identifyData := map[string]interface{}{
		"token":        c.token,
		"properties":   props,
		"capabilities": 16381,
		"compress":     false,
		"client_state": map[string]interface{}{
			"guild_versions": map[string]interface{}{},
		},
	}
	return c.SendOpcode(events.OpIdentify, identifyData)
}

func (c *Client) sendResume() error {
	c.setState(StateResuming)
	c.totalResumes.Add(1)
	sid, _, seq, _ := c.session.GetSessionInfo()
	resumeData := map[string]interface{}{
		"token":      c.token,
		"session_id": sid,
		"seq":        seq,
	}
	return c.SendOpcode(events.OpResume, resumeData)
}

func (c *Client) SendOpcode(op events.GatewayOpcode, data interface{}) error {
	c.mu.RLock()
	conn := c.conn
	c.mu.RUnlock()
	if conn == nil {
		return fmt.Errorf("gateway websocket not connected")
	}

	payload := events.OutboundGatewayPayload{
		Op: op,
		D:  data,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return conn.WriteMessage(websocket.TextMessage, raw)
}

func (c *Client) handleDispatch(payload events.GatewayPayload) {
	if payload.S != nil && payload.T != "" && payload.T != events.EventVoiceStateUpdate && payload.T != events.EventVoiceServerUpdate {
		dedupKey := fmt.Sprintf("%s:%d", payload.T, *payload.S)
		if c.dedup.IsDuplicate(dedupKey) {
			c.duplicateEventsDropped.Add(1)
			return
		}
	}

	c.eventsDispatched.Add(1)

	switch payload.T {
	case events.EventReady:
		var ready events.ReadyData
		if err := json.Unmarshal(payload.D, &ready); err == nil {
			c.session.SetSession(ready.SessionID, ready.ResumeGatewayURL, &ready.User)
			for _, g := range ready.Guilds {
				for _, vs := range g.VoiceStates {
					vs.GuildID = g.ID
					c.session.UpdateVoiceState(vs)
				}
			}
			c.setState(StateReady)
			c.backoff.Reset()
			if c.readySignaled.CompareAndSwap(false, true) {
				close(c.readyOnceCh)
			}

			c.mu.RLock()
			handlers := append([]ReadyHandler(nil), c.onReady...)
			c.mu.RUnlock()
			for _, fn := range handlers {
				go fn(&ready)
			}
		}

	case events.EventResumed:
		c.setState(StateReady)
		c.backoff.Reset()

	case events.EventGuildCreate:
		var gc events.GuildCreatePayload
		if err := json.Unmarshal(payload.D, &gc); err == nil {
			for _, vs := range gc.VoiceStates {
				vs.GuildID = gc.ID
				c.session.UpdateVoiceState(vs)
			}
		}

	case events.EventMessageCreate:
		var msg events.MessageCreateEvent
		if err := json.Unmarshal(payload.D, &msg); err == nil {
			c.mu.RLock()
			handlers := append([]MessageCreateHandler(nil), c.onMessageCreate...)
			c.mu.RUnlock()
			for _, fn := range handlers {
				go fn(msg)
			}
		}

	case events.EventVoiceStateUpdate:
		var vs events.VoiceStateEvent
		if err := json.Unmarshal(payload.D, &vs); err == nil {
			oldState := c.session.UpdateVoiceState(vs)
			c.mu.RLock()
			handlers := append([]VoiceStateUpdateHandler(nil), c.onVoiceStateUpdate...)
			c.mu.RUnlock()
			for _, fn := range handlers {
				go fn(oldState, vs)
			}
		}

	case events.EventVoiceServerUpdate:
		var vsu events.VoiceServerUpdateEvent
		if err := json.Unmarshal(payload.D, &vsu); err == nil {
			c.mu.RLock()
			handlers := append([]VoiceServerUpdateHandler(nil), c.onVoiceServerUpdate...)
			c.mu.RUnlock()
			for _, fn := range handlers {
				go fn(vsu)
			}
		}

	case events.EventStreamCreate:
		var sc events.StreamCreateEvent
		if err := json.Unmarshal(payload.D, &sc); err == nil {
			c.mu.RLock()
			handlers := append([]StreamCreateHandler(nil), c.onStreamCreate...)
			c.mu.RUnlock()
			for _, fn := range handlers {
				go fn(sc)
			}
		}

	case events.EventStreamServerUpdate:
		var ssu events.StreamServerUpdateEvent
		if err := json.Unmarshal(payload.D, &ssu); err == nil {
			c.mu.RLock()
			handlers := append([]StreamServerUpdateHandler(nil), c.onStreamServerUpdate...)
			c.mu.RUnlock()
			for _, fn := range handlers {
				go fn(ssu)
			}
		}
	}

	c.mu.RLock()
	dispatchHandlers := append([]DispatchHandler(nil), c.onDispatch...)
	c.mu.RUnlock()
	for _, fn := range dispatchHandlers {
		fn(payload.T, payload.D)
	}
}

func (c *Client) SendVoiceStateUpdate(guildID, channelID *string, selfMute, selfDeaf, selfVideo bool) error {
	return c.SendOpcode(events.OpVoiceStateUpdate, map[string]interface{}{
		"guild_id":   guildID,
		"channel_id": channelID,
		"self_mute":  selfMute,
		"self_deaf":  selfDeaf,
		"self_video": selfVideo,
	})
}

func (c *Client) SendStreamCreate(streamType, guildID, channelID string) error {
	return c.SendOpcode(events.OpStreamCreate, map[string]interface{}{
		"type":             streamType,
		"guild_id":         guildID,
		"channel_id":       channelID,
		"preferred_region": nil,
	})
}

func (c *Client) SendStreamSetPaused(streamKey string, paused bool) error {
	return c.SendOpcode(events.OpStreamSetPaused, map[string]interface{}{
		"stream_key": streamKey,
		"paused":     paused,
	})
}

func (c *Client) SendStreamWatch(streamKey string) error {
	return c.SendOpcode(events.OpStreamWatch, map[string]interface{}{
		"stream_key": streamKey,
	})
}

func (c *Client) SendStreamDelete(streamKey string) error {
	return c.SendOpcode(events.OpStreamDelete, map[string]interface{}{
		"stream_key": streamKey,
	})
}

func (c *Client) UpdatePresence(activityName string, activityType int) error {
	activities := []events.ActivityPayload{}
	if activityName != "" {
		activities = append(activities, events.ActivityPayload{
			Name: activityName,
			Type: activityType,
		})
	}
	return c.SendOpcode(events.OpPresenceUpdate, events.PresenceUpdatePayload{
		Since:      nil,
		Activities: activities,
		Status:     "online",
		AFK:        false,
	})
}

func (c *Client) UserID() string {
	u := c.User()
	if u != nil {
		return u.ID
	}
	return ""
}

func (c *Client) UserTag() string {
	u := c.User()
	if u == nil {
		return "Not Logged In"
	}
	if u.Discriminator != "" && u.Discriminator != "0" {
		return fmt.Sprintf("%s#%s", u.Username, u.Discriminator)
	}
	return u.Username
}

func (c *Client) UpdateVoiceState(guildID string, channelID *string, selfMute, selfDeaf, selfVideo bool) error {
	var g *string
	if guildID != "" {
		g = &guildID
	}
	return c.SendVoiceStateUpdate(g, channelID, selfMute, selfDeaf, selfVideo)
}

func (c *Client) CreateStream(streamType, guildID, channelID string, preferredRegion *string) error {
	return c.SendOpcode(events.OpStreamCreate, map[string]interface{}{
		"type":             streamType,
		"guild_id":         guildID,
		"channel_id":       channelID,
		"preferred_region": preferredRegion,
	})
}

func (c *Client) WatchStream(streamKey string) error {
	return c.SendStreamWatch(streamKey)
}

func (c *Client) SetStreamPaused(streamKey string, paused bool) error {
	return c.SendStreamSetPaused(streamKey, paused)
}

func (c *Client) DeleteStream(streamKey string) error {
	return c.SendStreamDelete(streamKey)
}

func (c *Client) UpdateStatusIdle(prefix string) error {
	if prefix == "" {
		prefix = "$"
	}
	return c.UpdatePresence(fmt.Sprintf("%shelp | Arychi Stream", prefix), 0)
}

func (c *Client) UpdateStatusWatch(title string) error {
	if title == "" {
		title = "Stream"
	}
	return c.UpdatePresence(title, 3) // 3 = Watching
}

func (c *Client) OnEvent(eventType string, handler func(eventType string, raw json.RawMessage)) {
	c.OnDispatch(func(t string, raw json.RawMessage) {
		if t == eventType {
			handler(t, raw)
		}
	})
}
