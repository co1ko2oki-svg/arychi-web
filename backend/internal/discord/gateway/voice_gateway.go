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
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func GenerateStreamKey(streamType, guildID, channelID, userID string) string {
	if streamType == "call" || guildID == "" {
		return fmt.Sprintf("call:%s:%s", channelID, userID)
	}
	return fmt.Sprintf("guild:%s:%s:%s", guildID, channelID, userID)
}

func ParseStreamKey(streamKey string) (streamType, guildID, channelID, userID string) {
	parts := strings.Split(streamKey, ":")
	if len(parts) == 4 && parts[0] == "guild" {
		return parts[0], parts[1], parts[2], parts[3]
	}
	if len(parts) == 3 && parts[0] == "call" {
		return parts[0], "", parts[1], parts[2]
	}
	return "", "", "", ""
}

type VoiceStreamDescriptor struct {
	Type       string `json:"type"`
	RID        string `json:"rid"`
	Quality    int    `json:"quality"`
	Active     bool   `json:"active,omitempty"`
	SSRC       uint32 `json:"ssrc,omitempty"`
	RTXSSRC    uint32 `json:"rtx_ssrc,omitempty"`
	MaxBitrate int    `json:"max_bitrate,omitempty"`
	MaxFPS     int    `json:"max_framerate,omitempty"`
}

type VoiceReadyPayload struct {
	SSRC    uint32   `json:"ssrc"`
	IP      string   `json:"ip"`
	Port    int      `json:"port"`
	Modes   []string `json:"modes"`
	Streams []struct {
		Type    string `json:"type"`
		RID     string `json:"rid"`
		Quality int    `json:"quality"`
		SSRC    uint32 `json:"ssrc"`
		RTXSSRC uint32 `json:"rtx_ssrc"`
	} `json:"streams"`
}

type VoiceHelloPayload struct {
	HeartbeatInterval float64 `json:"heartbeat_interval"`
}

type VoicePacket struct {
	Op  events.VoiceOpcode `json:"op"`
	D   json.RawMessage    `json:"d,omitempty"`
	Seq *int64             `json:"seq,omitempty"`
}

type MediaConnection struct {
	mu      sync.RWMutex
	writeMu sync.Mutex

	ServerID  string
	UserID    string
	ChannelID string
	SessionID string
	Token     string
	Endpoint  string
	StreamKey string

	conn       *websocket.Conn
	ctx        context.Context
	cancel     context.CancelFunc
	seqAck     atomic.Int64
	readyParams *VoiceReadyPayload
	readyCh    chan struct{}
	readyOnce  sync.Once
	closed     atomic.Bool
}

func NewMediaConnection(serverID, userID, channelID string) *MediaConnection {
	ctx, cancel := context.WithCancel(context.Background())
	mc := &MediaConnection{
		ServerID:  serverID,
		UserID:    userID,
		ChannelID: channelID,
		ctx:       ctx,
		cancel:    cancel,
		readyCh:   make(chan struct{}),
	}
	mc.seqAck.Store(-1)
	return mc
}

func (m *MediaConnection) SetSession(sessionID string) {
	m.mu.Lock()
	m.SessionID = sessionID
	canStart := m.SessionID != "" && m.Token != "" && m.Endpoint != "" && m.conn == nil
	m.mu.Unlock()
	if canStart {
		go m.connectLoop(false)
	}
}

func (m *MediaConnection) SetTokens(endpoint, token string) {
	m.mu.Lock()
	m.Endpoint = endpoint
	m.Token = token
	canStart := m.SessionID != "" && m.Token != "" && m.Endpoint != "" && m.conn == nil
	m.mu.Unlock()
	if canStart {
		go m.connectLoop(false)
	}
}

func (m *MediaConnection) WaitReady(ctx context.Context) error {
	select {
	case <-m.readyCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-m.ctx.Done():
		return fmt.Errorf("media connection closed")
	}
}

func (m *MediaConnection) Close() {
	if !m.closed.CompareAndSwap(false, true) {
		return
	}
	m.cancel()
	m.mu.Lock()
	conn := m.conn
	m.conn = nil
	m.mu.Unlock()
	if conn != nil {
		m.writeMu.Lock()
		_ = conn.Close()
		m.writeMu.Unlock()
	}
}

func (m *MediaConnection) connectLoop(resuming bool) {
	for !m.closed.Load() {
		m.mu.RLock()
		endpoint := m.Endpoint
		m.mu.RUnlock()
		if endpoint == "" {
			return
		}

		wsURL := endpoint
		if !strings.HasPrefix(wsURL, "wss://") && !strings.HasPrefix(wsURL, "ws://") {
			wsURL = "wss://" + strings.TrimSuffix(wsURL, ":80") + "/?v=8"
		} else if !strings.Contains(wsURL, "?") {
			wsURL = strings.TrimRight(wsURL, "/") + "/?v=8"
		}

		dialer := websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
			Proxy:            http.ProxyFromEnvironment,
		}
		headers := http.Header{}
		headers.Set("User-Agent", rest.DesktopUserAgent)

		conn, _, err := dialer.DialContext(m.ctx, wsURL, headers)
		if err != nil {
			return
		}

		m.mu.Lock()
		m.conn = conn
		m.mu.Unlock()

		if resuming {
			_ = m.sendResume()
		} else {
			_ = m.sendIdentify()
		}

		hbCtx, hbCancel := context.WithCancel(m.ctx)
		shouldResume := false

		for {
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				hbCancel()
				if closeErr, ok := err.(*websocket.CloseError); ok {
					act := reconnect.ClassifyVoiceCloseCode(closeErr.Code)
					if act.CanReconnect && !act.ShouldClearSession {
						shouldResume = true
					}
				}
				break
			}
			if msgType == websocket.BinaryMessage {
				if len(data) >= 2 {
					seq := int64(uint16(data[0])<<8 | uint16(data[1]))
					m.seqAck.Store(seq)
				}
				continue
			}

			var pkt VoicePacket
			if err := json.Unmarshal(data, &pkt); err != nil {
				continue
			}
			if pkt.Seq != nil {
				m.seqAck.Store(*pkt.Seq)
			}

			switch pkt.Op {
			case events.VoiceOpHello:
				var hello VoiceHelloPayload
				if err := json.Unmarshal(pkt.D, &hello); err == nil && hello.HeartbeatInterval > 0 {
					go m.heartbeatLoop(hbCtx, time.Duration(hello.HeartbeatInterval)*time.Millisecond)
				}

			case events.VoiceOpReady:
				var ready VoiceReadyPayload
				if err := json.Unmarshal(pkt.D, &ready); err == nil {
					m.mu.Lock()
					m.readyParams = &ready
					m.mu.Unlock()
					_ = m.SetVideoAttributes(false, 0, 0, 0)
					m.readyOnce.Do(func() {
						close(m.readyCh)
					})
				}

			case events.VoiceOpSelectProtocolAck, events.VoiceOpResumed:
				m.readyOnce.Do(func() {
					close(m.readyCh)
				})

			case events.VoiceOpDavePrepareTransition:
				var d struct {
					TransitionID int `json:"transition_id"`
				}
				if json.Unmarshal(pkt.D, &d) == nil && d.TransitionID != 0 {
					_ = m.SendOpcode(events.VoiceOpDaveTransitionReady, map[string]interface{}{
						"transition_id": d.TransitionID,
					})
				}
			}
		}

		hbCancel()
		_ = conn.Close()
		if !shouldResume || m.closed.Load() {
			return
		}
		resuming = true
		time.Sleep(500 * time.Millisecond)
	}
}

func (m *MediaConnection) heartbeatLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = m.SendOpcode(events.VoiceOpHeartbeat, map[string]interface{}{
				"t":       time.Now().UnixMilli(),
				"seq_ack": m.seqAck.Load(),
			})
		}
	}
}

func (m *MediaConnection) sendIdentify() error {
	m.mu.RLock()
	serverID := m.ServerID
	userID := m.UserID
	sessionID := m.SessionID
	token := m.Token
	m.mu.RUnlock()

	return m.SendOpcode(events.VoiceOpIdentify, map[string]interface{}{
		"server_id":  serverID,
		"user_id":    userID,
		"session_id": sessionID,
		"token":      token,
		"video":      true,
		"streams": []map[string]interface{}{
			{"type": "video", "rid": "100", "quality": 100},
		},
		"max_dave_protocol_version": 0,
	})
}

func (m *MediaConnection) sendResume() error {
	m.mu.RLock()
	serverID := m.ServerID
	sessionID := m.SessionID
	token := m.Token
	m.mu.RUnlock()

	return m.SendOpcode(events.VoiceOpResume, map[string]interface{}{
		"server_id":  serverID,
		"session_id": sessionID,
		"token":      token,
		"seq_ack":    m.seqAck.Load(),
	})
}

func (m *MediaConnection) SetVideoAttributes(enabled bool, width, height, fps int) error {
	m.mu.RLock()
	rp := m.readyParams
	m.mu.RUnlock()
	if rp == nil {
		return nil
	}

	var videoSSRC, rtxSSRC uint32
	if len(rp.Streams) > 0 {
		videoSSRC = rp.Streams[0].SSRC
		rtxSSRC = rp.Streams[0].RTXSSRC
	}

	if !enabled {
		return m.SendOpcode(events.VoiceOpVideo, map[string]interface{}{
			"audio_ssrc": rp.SSRC,
			"video_ssrc": 0,
			"rtx_ssrc":   0,
			"streams":    []interface{}{},
		})
	}

	return m.SendOpcode(events.VoiceOpVideo, map[string]interface{}{
		"audio_ssrc": rp.SSRC,
		"video_ssrc": videoSSRC,
		"rtx_ssrc":   rtxSSRC,
		"streams": []map[string]interface{}{
			{
				"type":          "video",
				"rid":           "100",
				"ssrc":          videoSSRC,
				"active":        true,
				"quality":       100,
				"rtx_ssrc":      rtxSSRC,
				"max_bitrate":   10000000,
				"max_framerate": fps,
				"max_resolution": map[string]interface{}{
					"type":   "fixed",
					"width":  width,
					"height": height,
				},
			},
		},
	})
}

func (m *MediaConnection) SetSpeaking(speaking int) error {
	m.mu.RLock()
	rp := m.readyParams
	m.mu.RUnlock()
	if rp == nil {
		return nil
	}
	return m.SendOpcode(events.VoiceOpSpeaking, map[string]interface{}{
		"delay":    0,
		"speaking": speaking,
		"ssrc":     rp.SSRC,
	})
}

func (m *MediaConnection) SelectWebRTCProtocol(sdp string) error {
	return m.SendOpcode(events.VoiceOpSelectProtocol, map[string]interface{}{
		"protocol":          "webrtc",
		"data":              sdp,
		"sdp":               sdp,
		"rtc_connection_id": uuid.NewString(),
		"codecs": []map[string]interface{}{
			{"name": "opus", "type": "audio", "priority": 1000, "payload_type": 120},
			{"name": "H264", "type": "video", "priority": 1000, "payload_type": 101, "rtx_payload_type": 102, "encode": true, "decode": true},
			{"name": "H265", "type": "video", "priority": 1000, "payload_type": 103, "rtx_payload_type": 104, "encode": true, "decode": true},
			{"name": "VP8", "type": "video", "priority": 1000, "payload_type": 105, "rtx_payload_type": 106, "encode": true, "decode": true},
			{"name": "VP9", "type": "video", "priority": 1000, "payload_type": 107, "rtx_payload_type": 108, "encode": true, "decode": true},
			{"name": "AV1", "type": "video", "priority": 1000, "payload_type": 109, "rtx_payload_type": 110, "encode": true, "decode": true},
		},
	})
}

func (m *MediaConnection) SendOpcode(op events.VoiceOpcode, data interface{}) error {
	m.mu.RLock()
	conn := m.conn
	m.mu.RUnlock()
	if conn == nil {
		return fmt.Errorf("voice websocket not connected")
	}
	raw, err := json.Marshal(map[string]interface{}{
		"op": op,
		"d":  data,
	})
	if err != nil {
		return err
	}
	m.writeMu.Lock()
	defer m.writeMu.Unlock()
	_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return conn.WriteMessage(websocket.TextMessage, raw)
}
