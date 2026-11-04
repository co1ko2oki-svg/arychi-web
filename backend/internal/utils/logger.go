package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"os"
	"strings"
	"sync"
	"time"
)

type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	QuestID   string `json:"questId,omitempty"`
}

type LogSubscriber func(entry LogEntry)

type LogHub struct {
	mu          sync.RWMutex
	buffer      []LogEntry
	maxSize     int
	subscribers map[int]LogSubscriber
	nextSubID   int
	prefix      string
}

func NewLogHub(maxSize int, prefix string) *LogHub {
	if maxSize <= 0 {
		maxSize = 300
	}
	return &LogHub{
		buffer:      make([]LogEntry, 0, maxSize),
		maxSize:     maxSize,
		subscribers: make(map[int]LogSubscriber),
		prefix:      prefix,
	}
}

func (h *LogHub) Add(level string, message string, questID ...string) LogEntry {
	var qID string
	if len(questID) > 0 {
		qID = questID[0]
	}

	now := time.Now().UTC()
	entry := LogEntry{
		Timestamp: now.Format("2006-01-02T15:04:05.000Z"),
		Level:     level,
		Message:   message,
		QuestID:   qID,
	}

	h.mu.Lock()
	h.buffer = append(h.buffer, entry)
	if len(h.buffer) > h.maxSize {
		h.buffer = h.buffer[len(h.buffer)-h.maxSize:]
	}
	subs := make([]LogSubscriber, 0, len(h.subscribers))
	for _, fn := range h.subscribers {
		subs = append(subs, fn)
	}
	h.mu.Unlock()

	timeLabel := time.Now().Format("15:04:05")
	upperLevel := strings.ToUpper(level)
	prefixLabel := fmt.Sprintf("[%s] [%s]", timeLabel, upperLevel)
	if h.prefix != "" {
		prefixLabel = fmt.Sprintf("[%s] [%s] [%s]", h.prefix, timeLabel, upperLevel)
	}

	if level == "error" {
		fmt.Fprintln(os.Stderr, prefixLabel, message)
	} else {
		fmt.Fprintln(os.Stdout, prefixLabel, message)
	}

	for _, fn := range subs {
		fn(entry)
	}

	return entry
}

func (h *LogHub) GetLogs(limit int) []LogEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.buffer) == 0 {
		return []LogEntry{}
	}
	if limit <= 0 || limit >= len(h.buffer) {
		out := make([]LogEntry, len(h.buffer))
		copy(out, h.buffer)
		return out
	}
	start := len(h.buffer) - limit
	out := make([]LogEntry, limit)
	copy(out, h.buffer[start:])
	return out
}

func (h *LogHub) Subscribe(fn LogSubscriber) func() {
	h.mu.Lock()
	id := h.nextSubID
	h.nextSubID++
	h.subscribers[id] = fn
	h.mu.Unlock()

	return func() {
		h.mu.Lock()
		delete(h.subscribers, id)
		h.mu.Unlock()
	}
}

func (h *LogHub) Info(format string, args ...any) LogEntry {
	msg := fmt.Sprintf(format, args...)
	return h.Add("info", msg)
}

func (h *LogHub) Warn(format string, args ...any) LogEntry {
	msg := fmt.Sprintf(format, args...)
	return h.Add("warn", msg)
}

func (h *LogHub) Error(format string, args ...any) LogEntry {
	msg := fmt.Sprintf(format, args...)
	return h.Add("error", msg)
}

func (h *LogHub) Success(format string, args ...any) LogEntry {
	msg := fmt.Sprintf(format, args...)
	return h.Add("success", msg)
}

func (h *LogHub) Recent(limit int) []LogEntry {
	return h.GetLogs(limit)
}

func (h *LogHub) All() []LogEntry {
	return h.GetLogs(0)
}

var (
	QuestLogs  = NewLogHub(300, "")
	StreamLogs = NewLogHub(300, "")
)

func AddQuestLog(level, message string, questID ...string) LogEntry {
	return QuestLogs.Add(level, message, questID...)
}

func AddStreamLog(level, message string) LogEntry {
	return StreamLogs.Add(level, message)
}

func HashToken(token string) string {
	clean := strings.TrimSpace(token)
	sum := sha256.Sum256([]byte(clean))
	return hex.EncodeToString(sum[:])[:16]
}

func MaskToken(token string) string {
	clean := CleanToken(token)
	if len(clean) < 12 {
		return "***"
	}
	return fmt.Sprintf("%s...%s", clean[:6], clean[len(clean)-4:])
}

func CleanToken(token string) string {
	clean := strings.TrimSpace(token)
	if len(clean) >= 4 && strings.EqualFold(clean[:4], "Bot ") {
		clean = strings.TrimSpace(clean[4:])
	}
	if len(clean) >= 7 && strings.EqualFold(clean[:7], "Bearer ") {
		clean = strings.TrimSpace(clean[7:])
	}
	return strings.TrimSpace(clean)
}

func FormatBytes(bytes int64) string {
	if bytes <= 0 {
		return "0 Bytes"
	}
	const k = 1024.0
	sizes := []string{"Bytes", "KB", "MB", "GB", "TB"}
	i := int(math.Floor(math.Log(float64(bytes)) / math.Log(k)))
	if i >= len(sizes) {
		i = len(sizes) - 1
	}
	val := float64(bytes) / math.Pow(k, float64(i))
	formatted := strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", val), "0"), ".")
	return fmt.Sprintf("%s %s", formatted, sizes[i])
}

func FormatDuration(totalSeconds int64) string {
	if totalSeconds < 0 {
		totalSeconds = 0
	}
	hours := totalSeconds / 3600
	minutes := (totalSeconds % 3600) / 60
	seconds := totalSeconds % 60
	if hours > 0 {
		return fmt.Sprintf("%dh %dm %ds", hours, minutes, seconds)
	}
	return fmt.Sprintf("%dm %ds", minutes, seconds)
}
