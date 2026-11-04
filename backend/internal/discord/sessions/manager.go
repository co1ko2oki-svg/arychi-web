package sessions

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"arychi-web/backend/internal/discord/events"
)

type SessionState struct {
	mu               sync.RWMutex
	sessionID        string
	resumeGatewayURL string
	sequence         atomic.Int64
	hasSequence      atomic.Bool
	selfUser         *events.UserPayload
	voiceStates      map[string]map[string]events.VoiceStateEvent // guildID -> userID -> VoiceStateEvent
}

func NewSessionState(token ...string) *SessionState {
	return &SessionState{
		voiceStates: make(map[string]map[string]events.VoiceStateEvent),
	}
}

func (s *SessionState) SetReady(sessionID, resumeGatewayURL, userID, username string) {
	s.SetSession(sessionID, resumeGatewayURL, &events.UserPayload{
		ID:       userID,
		Username: username,
	})
}

func (s *SessionState) SetSession(sessionID, resumeGatewayURL string, user *events.UserPayload) {
	s.mu.Lock()
	s.sessionID = sessionID
	if resumeGatewayURL != "" {
		s.resumeGatewayURL = resumeGatewayURL
	}
	if user != nil {
		cp := *user
		s.selfUser = &cp
	}
	s.mu.Unlock()
}

func (s *SessionState) ClearSession() {
	s.mu.Lock()
	s.sessionID = ""
	s.resumeGatewayURL = ""
	s.mu.Unlock()
	s.sequence.Store(0)
	s.hasSequence.Store(false)
}

func (s *SessionState) CanResume() bool {
	s.mu.RLock()
	sid := s.sessionID
	s.mu.RUnlock()
	return sid != "" && s.hasSequence.Load()
}

func (s *SessionState) GetSessionInfo() (sessionID, resumeURL string, seq int64, hasSeq bool) {
	s.mu.RLock()
	sessionID = s.sessionID
	resumeURL = s.resumeGatewayURL
	s.mu.RUnlock()
	seq = s.sequence.Load()
	hasSeq = s.hasSequence.Load()
	return
}

func (s *SessionState) UpdateSequence(seq int64) {
	s.sequence.Store(seq)
	s.hasSequence.Store(true)
}

func (s *SessionState) GetSequence() int64 {
	return s.sequence.Load()
}

func (s *SessionState) SequencePtr() *int64 {
	if !s.hasSequence.Load() {
		return nil
	}
	v := s.sequence.Load()
	return &v
}

func (s *SessionState) SelfUser() *events.UserPayload {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.selfUser == nil {
		return nil
	}
	cp := *s.selfUser
	return &cp
}

func (s *SessionState) UpdateVoiceState(vs events.VoiceStateEvent) (oldState *events.VoiceStateEvent) {
	guildID := vs.GuildID
	if guildID == "" {
		guildID = "@me"
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	guildMap, ok := s.voiceStates[guildID]
	if !ok {
		guildMap = make(map[string]events.VoiceStateEvent)
		s.voiceStates[guildID] = guildMap
	}
	if prev, exists := guildMap[vs.UserID]; exists {
		cp := prev
		oldState = &cp
	}
	if vs.ChannelID == nil || *vs.ChannelID == "" {
		delete(guildMap, vs.UserID)
	} else {
		guildMap[vs.UserID] = vs
	}
	return oldState
}

func (s *SessionState) GetVoiceState(guildID, userID string) *events.VoiceStateEvent {
	if guildID == "" {
		guildID = "@me"
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if guildMap, ok := s.voiceStates[guildID]; ok {
		if vs, exists := guildMap[userID]; exists {
			cp := vs
			return &cp
		}
	}
	return nil
}

type SessionStartLimit struct {
	Total          int `json:"total"`
	Remaining      int `json:"remaining"`
	ResetAfterMs   int `json:"reset_after"`
	MaxConcurrency int `json:"max_concurrency"`
}

type IdentifyLimiter struct {
	mu           sync.Mutex
	minInterval  time.Duration
	lastIdentify time.Time
	limitInfo    SessionStartLimit
}

func NewIdentifyLimiter() *IdentifyLimiter {
	return &IdentifyLimiter{
		minInterval: 5100 * time.Millisecond,
		limitInfo: SessionStartLimit{
			Total:          1000,
			Remaining:      1000,
			ResetAfterMs:   14400000,
			MaxConcurrency: 1,
		},
	}
}

func (l *IdentifyLimiter) Wait(ctx context.Context) error {
	l.mu.Lock()
	now := time.Now()
	var waitDur time.Duration
	if !l.lastIdentify.IsZero() {
		elapsed := now.Sub(l.lastIdentify)
		if elapsed < l.minInterval {
			waitDur = l.minInterval - elapsed
		}
	}
	l.lastIdentify = now.Add(waitDur)
	l.mu.Unlock()

	if waitDur > 0 {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitDur):
		}
	}
	return nil
}

type EventDeduplicator struct {
	mu      sync.Mutex
	ring    []string
	set     map[string]struct{}
	maxSize int
	cursor  int
}

func NewEventDeduplicator(maxSize int) *EventDeduplicator {
	if maxSize <= 0 {
		maxSize = 512
	}
	return &EventDeduplicator{
		ring:    make([]string, maxSize),
		set:     make(map[string]struct{}, maxSize),
		maxSize: maxSize,
	}
}

func (d *EventDeduplicator) IsDuplicate(key string) bool {
	if key == "" {
		return false
	}
	d.mu.Lock()
	defer d.mu.Unlock()

	if _, exists := d.set[key]; exists {
		return true
	}

	old := d.ring[d.cursor]
	if old != "" {
		delete(d.set, old)
	}
	d.ring[d.cursor] = key
	d.set[key] = struct{}{}
	d.cursor = (d.cursor + 1) % d.maxSize
	return false
}
