package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/discord/gateway"
	"arychi-web/backend/internal/discord/reconnect"
	"arychi-web/backend/internal/discord/sessions"
	"arychi-web/backend/internal/utils"
	"github.com/gorilla/websocket"
)

func TestCloseCodeClassification(t *testing.T) {
	tests := []struct {
		code            int
		shouldReconnect bool
		canResume       bool
		fatal           bool
	}{
		{reconnect.CloseUnknownError, true, true, false},
		{reconnect.CloseSessionTimedOut, true, false, false},
		{reconnect.CloseAuthenticationFailed, false, false, true},
		{reconnect.CloseInvalidShard, false, false, true},
		{reconnect.CloseDisallowedIntents, false, false, true},
		{reconnect.CloseRateLimited, true, true, false},
	}

	for _, tc := range tests {
		action := reconnect.ClassifyGatewayCloseCode(tc.code)
		if action.ShouldReconnect != tc.shouldReconnect {
			t.Errorf("code %d: expected ShouldReconnect=%v, got %v", tc.code, tc.shouldReconnect, action.ShouldReconnect)
		}
		if action.CanResume != tc.canResume {
			t.Errorf("code %d: expected CanResume=%v, got %v", tc.code, tc.canResume, action.CanResume)
		}
		if action.Fatal != tc.fatal {
			t.Errorf("code %d: expected Fatal=%v, got %v", tc.code, tc.fatal, action.Fatal)
		}
	}

	voiceFatal := reconnect.ClassifyVoiceCloseCode(reconnect.VoiceCloseSessionNoLongerValid)
	if !voiceFatal.ShouldReconnect || voiceFatal.CanResume {
		t.Errorf("expected VoiceCloseSessionNoLongerValid to reconnect without resume")
	}

	voiceDisconn := reconnect.ClassifyVoiceCloseCode(reconnect.VoiceCloseDisconnected)
	if voiceDisconn.ShouldReconnect {
		t.Errorf("expected VoiceCloseDisconnected not to auto-reconnect")
	}
}

func TestExponentialBackoffWithJitter(t *testing.T) {
	b := reconnect.NewBackoff(100*time.Millisecond, 2*time.Second)
	for i := 0; i < 6; i++ {
		d, ok := b.NextDelay()
		if !ok || d < 100*time.Millisecond || d > 2*time.Second {
			t.Fatalf("delay out of bounds: %v", d)
		}
	}
	if b.Attempt() != 6 {
		t.Fatalf("expected attempt 6, got %d", b.Attempt())
	}
	b.Reset()
	if b.Attempt() != 0 {
		t.Fatalf("expected attempt 0 after Reset, got %d", b.Attempt())
	}
}

func TestSessionManagerAndDeduplicator(t *testing.T) {
	sess := sessions.NewSessionState("token_1")
	sess.UpdateSequence(42)
	if sess.GetSequence() != 42 {
		t.Fatalf("expected sequence 42, got %d", sess.GetSequence())
	}

	sess.SetReady("sess_abc", "wss://resume.discord.gg", "123456", "arychi#0001")
	if !sess.CanResume() {
		t.Fatalf("expected session to be resumable")
	}

	chID := "chan_99"
	sess.UpdateVoiceState(events.VoiceState{
		GuildID:    "guild_1",
		ChannelID:  &chID,
		UserID:     "user_1",
		SelfStream: true,
	})
	vs := sess.GetVoiceState("guild_1", "user_1")
	if vs == nil || !vs.SelfStream {
		t.Fatalf("expected voice state with SelfStream=true")
	}

	sess.UpdateVoiceState(events.VoiceState{
		GuildID:   "guild_1",
		ChannelID: nil,
		UserID:    "user_1",
	})
	if sess.GetVoiceState("guild_1", "user_1") != nil {
		t.Fatalf("expected voice state to be removed on nil channel")
	}

	dedup := sessions.NewEventDeduplicator(10)
	if dedup.IsDuplicate("1:MESSAGE_CREATE") {
		t.Fatalf("first event should not be duplicate")
	}
	if !dedup.IsDuplicate("1:MESSAGE_CREATE") {
		t.Fatalf("second identical event should be duplicate")
	}
}

func TestStreamKeyGenerationAndParsing(t *testing.T) {
	key := gateway.GenerateStreamKey("guild", "111", "222", "333")
	if key != "guild:111:222:333" {
		t.Fatalf("unexpected stream key: %s", key)
	}
	sType, gID, cID, uID := gateway.ParseStreamKey(key)
	if sType != "guild" || gID != "111" || cID != "222" || uID != "333" {
		t.Fatalf("unexpected parsed components: %s %s %s %s", sType, gID, cID, uID)
	}
}

func TestGatewayLifecycleIdentifyHeartbeatAndVoiceSignaling(t *testing.T) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	var receivedIdentify int32
	var receivedHeartbeat int32
	var receivedVoiceState int32
	var receivedStreamWatch int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		// Send HELLO (Op 10)
		helloPayload := map[string]any{
			"op": events.OpHello,
			"d": map[string]any{
				"heartbeat_interval": 150,
			},
		}
		_ = conn.WriteJSON(helloPayload)

		for {
			_, msgBytes, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var pkt events.GatewayPayload
			if json.Unmarshal(msgBytes, &pkt) != nil {
				continue
			}

			switch pkt.Op {
			case events.OpHeartbeat:
				atomic.AddInt32(&receivedHeartbeat, 1)
				_ = conn.WriteJSON(map[string]any{
					"op": events.OpHeartbeatACK,
				})
			case events.OpIdentify:
				atomic.AddInt32(&receivedIdentify, 1)
				seq := int64(1)
				_ = conn.WriteJSON(map[string]any{
					"op": events.OpDispatch,
					"t":  events.EventReady,
					"s":  seq,
					"d": map[string]any{
						"v":                  10,
						"session_id":         "mock_session_123",
						"resume_gateway_url": "ws://" + r.Host,
						"user": map[string]any{
							"id":            "999888777",
							"username":      "ArychiTester",
							"discriminator": "0",
						},
					},
				})
			case events.OpVoiceStateUpdate:
				atomic.AddInt32(&receivedVoiceState, 1)
			case events.OpStreamWatch:
				atomic.AddInt32(&receivedStreamWatch, 1)
			}
		}
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	client := gateway.NewClient(gateway.ClientOptions{
		Token:      "test_token_1234567890",
		GatewayURL: wsURL,
		Logger:     utils.NewLogHub(50, ""),
	})
	defer client.Close()

	readyCh := make(chan string, 1)
	client.OnReady(func(r *events.ReadyData) {
		readyCh <- r.User.ID
	})

	if err := client.Connect(); err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	select {
	case uid := <-readyCh:
		if uid != "999888777" {
			t.Fatalf("expected user ID 999888777, got %s", uid)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out waiting for READY")
	}

	chID := "voice_chan_1"
	if err := client.UpdateVoiceState("guild_1", &chID, true, true, false); err != nil {
		t.Fatalf("UpdateVoiceState failed: %v", err)
	}
	if err := client.WatchStream("guild:guild_1:voice_chan_1:999888777"); err != nil {
		t.Fatalf("WatchStream failed: %v", err)
	}

	time.Sleep(250 * time.Millisecond)

	if atomic.LoadInt32(&receivedIdentify) < 1 {
		t.Errorf("expected Identify to be received")
	}
	if atomic.LoadInt32(&receivedHeartbeat) < 1 {
		t.Errorf("expected Heartbeat to be received")
	}
	if atomic.LoadInt32(&receivedVoiceState) < 1 {
		t.Errorf("expected VoiceStateUpdate to be received")
	}
	if atomic.LoadInt32(&receivedStreamWatch) < 1 {
		t.Errorf("expected StreamWatch to be received")
	}

	metrics := client.GetMetrics()
	if metrics.IdentifiesSent < 1 || metrics.HeartbeatsSent < 1 || metrics.HeartbeatACKs < 1 {
		t.Errorf("unexpected gateway metrics: %+v", metrics)
	}
}
