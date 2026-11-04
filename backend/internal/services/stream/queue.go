package stream

import (
	"sync"
	"time"

	"arychi-web/backend/internal/utils"
	"github.com/google/uuid"
)

type MediaSource struct {
	URL    string `json:"url"`
	Title  string `json:"title"`
	Type   string `json:"type"` // "youtube" | "twitch" | "local" | "url"
	IsLive bool   `json:"isLive,omitempty"`
}

type QueueItem struct {
	ID            string    `json:"id"`
	URL           string    `json:"url"`
	Title         string    `json:"title"`
	Type          string    `json:"type"`
	IsLive        bool      `json:"isLive,omitempty"`
	RequestedBy   string    `json:"requestedBy"`
	AddedAt       time.Time `json:"addedAt"`
	OriginalInput string    `json:"originalInput,omitempty"`
	Resolved      bool      `json:"resolved,omitempty"`
}

type VideoQueue struct {
	Items        []QueueItem `json:"items"`
	CurrentIndex int         `json:"currentIndex"`
	IsPlaying    bool        `json:"isPlaying"`
}

type ChannelInfo struct {
	GuildID      string `json:"guildId"`
	ChannelID    string `json:"channelId"`
	CmdChannelID string `json:"cmdChannelId"`
}

type StreamStatus struct {
	Joined      bool        `json:"joined"`
	JoinSucc    bool        `json:"joinsucc"`
	Playing     bool        `json:"playing"`
	ManualStop  bool        `json:"manualStop"`
	IsLooping   bool        `json:"isLooping"`
	ChannelInfo ChannelInfo `json:"channelInfo"`
	Queue       VideoQueue  `json:"queue"`
}

type Video struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type QueueService struct {
	mu    sync.RWMutex
	queue VideoQueue
}

func NewQueueService() *QueueService {
	return &QueueService{
		queue: VideoQueue{
			Items:        []QueueItem{},
			CurrentIndex: -1,
			IsPlaying:    false,
		},
	}
}

func (q *QueueService) AddToQueue(mediaSource MediaSource, requestedBy string, originalInput string) QueueItem {
	orig := originalInput
	if orig == "" {
		orig = mediaSource.URL
	}
	return q.Add(
		mediaSource.URL,
		mediaSource.Title,
		requestedBy,
		mediaSource.Type,
		mediaSource.IsLive,
		orig,
	)
}

func (q *QueueService) Add(url, title, requestedBy, itemType string, isLive bool, originalInput string) QueueItem {
	if itemType == "" {
		itemType = "url"
	}
	if originalInput == "" {
		originalInput = url
	}

	item := QueueItem{
		ID:            uuid.NewString(),
		URL:           url,
		Title:         title,
		Type:          itemType,
		IsLive:        isLive,
		RequestedBy:   requestedBy,
		AddedAt:       time.Now(),
		OriginalInput: originalInput,
		Resolved:      originalInput == url,
	}

	q.mu.Lock()
	q.queue.Items = append(q.queue.Items, item)
	q.mu.Unlock()

	utils.StreamLogs.Info("Added to queue: %s (requested by %s)", title, requestedBy)
	return item
}

func (q *QueueService) GetNext() *QueueItem {
	q.mu.Lock()
	defer q.mu.Unlock()

	if len(q.queue.Items) == 0 {
		q.queue.CurrentIndex = -1
		return nil
	}

	if q.queue.CurrentIndex < len(q.queue.Items)-1 {
		q.queue.CurrentIndex++
		item := q.queue.Items[q.queue.CurrentIndex]
		return &item
	}

	q.queue.CurrentIndex = -1
	return nil
}

func (q *QueueService) GetCurrent() *QueueItem {
	q.mu.RLock()
	defer q.mu.RUnlock()

	if len(q.queue.Items) == 0 {
		return nil
	}
	if q.queue.CurrentIndex >= 0 && q.queue.CurrentIndex < len(q.queue.Items) {
		item := q.queue.Items[q.queue.CurrentIndex]
		return &item
	}
	return nil
}

func (q *QueueService) Skip() *QueueItem {
	current := q.GetCurrent()
	if current != nil {
		q.RemoveFromQueue(current.ID)
	}
	return q.GetNext()
}

func (q *QueueService) RemoveFromQueue(id string) bool {
	q.mu.Lock()
	defer q.mu.Unlock()

	idx := -1
	for i, item := range q.queue.Items {
		if item.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}

	q.queue.Items = append(q.queue.Items[:idx], q.queue.Items[idx+1:]...)
	if idx <= q.queue.CurrentIndex {
		q.queue.CurrentIndex--
	}
	return true
}

func (q *QueueService) ClearQueue() {
	q.mu.Lock()
	q.queue.Items = []QueueItem{}
	q.queue.CurrentIndex = -1
	q.queue.IsPlaying = false
	q.mu.Unlock()
	utils.StreamLogs.Info("Queue cleared")
}

func (q *QueueService) ResetCurrentIndex() {
	q.mu.Lock()
	q.queue.CurrentIndex = -1
	q.mu.Unlock()
}

func (q *QueueService) GetQueue() []QueueItem {
	q.mu.RLock()
	defer q.mu.RUnlock()

	items := make([]QueueItem, len(q.queue.Items))
	copy(items, q.queue.Items)
	return items
}

func (q *QueueService) GetQueueStatus() VideoQueue {
	q.mu.RLock()
	defer q.mu.RUnlock()

	items := make([]QueueItem, len(q.queue.Items))
	copy(items, q.queue.Items)
	return VideoQueue{
		Items:        items,
		CurrentIndex: q.queue.CurrentIndex,
		IsPlaying:    q.queue.IsPlaying,
	}
}

func (q *QueueService) SetPlaying(isPlaying bool) {
	q.mu.Lock()
	q.queue.IsPlaying = isPlaying
	q.mu.Unlock()
}

func (q *QueueService) IsEmpty() bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return len(q.queue.Items) == 0
}

func (q *QueueService) GetLength() int {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return len(q.queue.Items)
}

func (q *QueueService) MoveItem(fromIndex, toIndex int) bool {
	q.mu.Lock()
	defer q.mu.Unlock()

	n := len(q.queue.Items)
	if fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n {
		return false
	}

	item := q.queue.Items[fromIndex]
	q.queue.Items = append(q.queue.Items[:fromIndex], q.queue.Items[fromIndex+1:]...)

	rear := make([]QueueItem, len(q.queue.Items[toIndex:]))
	copy(rear, q.queue.Items[toIndex:])
	q.queue.Items = append(q.queue.Items[:toIndex], item)
	q.queue.Items = append(q.queue.Items, rear...)

	if fromIndex == q.queue.CurrentIndex {
		q.queue.CurrentIndex = toIndex
	} else if fromIndex < q.queue.CurrentIndex && toIndex >= q.queue.CurrentIndex {
		q.queue.CurrentIndex--
	} else if fromIndex > q.queue.CurrentIndex && toIndex <= q.queue.CurrentIndex {
		q.queue.CurrentIndex++
	}

	return true
}
