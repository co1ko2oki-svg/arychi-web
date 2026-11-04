package reconnect

import (
	"math"
	"math/rand"
	"sync"
	"time"
)

type Backoff struct {
	mu          sync.Mutex
	minDelay    time.Duration
	maxDelay    time.Duration
	multiplier  float64
	jitterRatio float64
	attempts    int
	maxAttempts int
}

func NewBackoff(minDelay, maxDelay time.Duration, maxAttempts ...int) *Backoff {
	if minDelay <= 0 {
		minDelay = 1 * time.Second
	}
	if maxDelay < minDelay {
		maxDelay = 60 * time.Second
	}
	maxAtt := 0
	if len(maxAttempts) > 0 {
		maxAtt = maxAttempts[0]
	}
	return &Backoff{
		minDelay:    minDelay,
		maxDelay:    maxDelay,
		multiplier:  2.0,
		jitterRatio: 0.35,
		maxAttempts: maxAtt,
	}
}

func (b *Backoff) NextDelay() (time.Duration, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.attempts++
	if b.maxAttempts > 0 && b.attempts > b.maxAttempts {
		return 0, false
	}

	exp := math.Pow(b.multiplier, float64(b.attempts-1))
	raw := float64(b.minDelay) * exp
	if raw > float64(b.maxDelay) {
		raw = float64(b.maxDelay)
	}

	jitterWindow := raw * b.jitterRatio
	jitter := (rand.Float64()*2.0 - 1.0) * jitterWindow
	finalDelay := time.Duration(math.Max(float64(b.minDelay), math.Min(float64(b.maxDelay), raw+jitter)))
	return finalDelay, true
}

func (b *Backoff) Reset() {
	b.mu.Lock()
	b.attempts = 0
	b.mu.Unlock()
}

func (b *Backoff) Attempts() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.attempts
}

func (b *Backoff) Attempt() int {
	return b.Attempts()
}

func RandomInvalidSessionDelay() time.Duration {
	ms := 1000 + rand.Intn(4001)
	return time.Duration(ms) * time.Millisecond
}

func InitialHeartbeatJitter(interval time.Duration) time.Duration {
	if interval <= 0 {
		return time.Second
	}
	factor := 0.1 + rand.Float64()*0.85
	return time.Duration(float64(interval) * factor)
}
