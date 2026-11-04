package quest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/discord/rest"
	"arychi-web/backend/internal/utils"
)

const maxJobsHistory = 150

type QuestJob struct {
	QuestID          string             `json:"questId"`
	TokenKey         string             `json:"tokenKey"`
	TokenMasked      string             `json:"tokenMasked"`
	QuestName        string             `json:"questName"`
	TaskType         string             `json:"taskType"`
	Status           string             `json:"status"`
	ProgressPercent  int                `json:"progressPercent"`
	CurrentSeconds   int                `json:"currentSeconds"`
	TargetSeconds    int                `json:"targetSeconds"`
	RemainingMinutes int                `json:"remainingMinutes"`
	Message          string             `json:"message"`
	StartedAt        int64              `json:"startedAt"`
	CompletedAt      *int64             `json:"completedAt,omitempty"`
	Cancel           context.CancelFunc `json:"-"`
}

type JobEventSubscriber func(eventType string, job QuestJob)

type ClientSession struct {
	Rest         *rest.Client
	QuestManager *QuestManager
}

type QuestService struct {
	mu          sync.RWMutex
	clients     map[string]*ClientSession
	jobs        map[string]*QuestJob
	jobOrder    []string
	subscribers map[int]JobEventSubscriber
	nextSubID   int
	httpClient  *http.Client
}

func NewQuestService() *QuestService {
	return &QuestService{
		clients:     make(map[string]*ClientSession),
		jobs:        make(map[string]*QuestJob),
		jobOrder:    make([]string, 0),
		subscribers: make(map[int]JobEventSubscriber),
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *QuestService) Subscribe(fn JobEventSubscriber) func() {
	s.mu.Lock()
	id := s.nextSubID
	s.nextSubID++
	s.subscribers[id] = fn
	s.mu.Unlock()

	return func() {
		s.mu.Lock()
		delete(s.subscribers, id)
		s.mu.Unlock()
	}
}

func (s *QuestService) OnJobEvent(fn JobEventSubscriber) func() {
	return s.Subscribe(fn)
}

func (s *QuestService) emit(eventType string, job QuestJob) {
	s.mu.RLock()
	subs := make([]JobEventSubscriber, 0, len(s.subscribers))
	for _, fn := range s.subscribers {
		subs = append(subs, fn)
	}
	s.mu.RUnlock()

	for _, fn := range subs {
		go fn(eventType, job)
	}
}

func (s *QuestService) GetOrCreateClient(token string) *ClientSession {
	tokenKey := utils.HashToken(token)
	s.mu.Lock()
	defer s.mu.Unlock()

	if cs, exists := s.clients[tokenKey]; exists {
		return cs
	}
	cs := &ClientSession{
		Rest: rest.NewClient(token),
	}
	s.clients[tokenKey] = cs
	return cs
}

type VerifyTokenResult struct {
	Valid bool              `json:"valid"`
	User  *rest.DiscordUser `json:"user,omitempty"`
	Error string            `json:"error,omitempty"`
}

func (s *QuestService) VerifyToken(ctx context.Context, rawToken, preferredType string) VerifyTokenResult {
	cleanToken := utils.CleanToken(rawToken)
	if cleanToken == "" {
		return VerifyTokenResult{Valid: false, Error: "Token không được để trống."}
	}

	isExplicitBot := preferredType == "bot" || strings.HasPrefix(strings.TrimSpace(rawToken), "Bot ")

	tryBotAuth := func() *rest.DiscordUser {
		req, err := http.NewRequestWithContext(ctx, "GET", rest.DiscordAPIBaseV10+"/users/@me", nil)
		if err != nil {
			return nil
		}
		req.Header.Set("Authorization", "Bot "+cleanToken)
		req.Header.Set("User-Agent", "DiscordBot (https://discord.com, v10)")
		resp, err := s.httpClient.Do(req)
		if err != nil {
			return nil
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil
		}
		var data struct {
			ID            string  `json:"id"`
			Username      string  `json:"username"`
			Discriminator string  `json:"discriminator"`
			Avatar        *string `json:"avatar"`
			Email         string  `json:"email"`
		}
		if json.NewDecoder(resp.Body).Decode(&data) != nil || data.ID == "" {
			return nil
		}
		if data.Discriminator == "" {
			data.Discriminator = "0000"
		}
		avatarURL := rest.FormatAvatarURL(data.ID, data.Discriminator, data.Avatar)
		return &rest.DiscordUser{
			ID:            data.ID,
			Username:      data.Username,
			Discriminator: data.Discriminator,
			Avatar:        data.Avatar,
			AvatarURL:     &avatarURL,
			Email:         data.Email,
			Bot:           true,
			Type:          "bot",
		}
	}

	if isExplicitBot {
		if botUser := tryBotAuth(); botUser != nil {
			utils.AddQuestLog("success", fmt.Sprintf("Đã xác thực thành công Bot Discord @%s (%s)", botUser.Username, botUser.ID))
			return VerifyTokenResult{Valid: true, User: botUser}
		}
	}

	cs := s.GetOrCreateClient(cleanToken)
	user, err := cs.Rest.GetUserInfo(ctx)
	if err == nil && user != nil {
		user.Bot = false
		user.Type = "user"
		utils.AddQuestLog("info", fmt.Sprintf("Verified token for user @%s (%s)", user.Username, user.ID))
		return VerifyTokenResult{Valid: true, User: user}
	}

	if !isExplicitBot {
		if botUser := tryBotAuth(); botUser != nil {
			utils.AddQuestLog("success", fmt.Sprintf("Đã tự động xác thực Bot Discord @%s (%s)", botUser.Username, botUser.ID))
			return VerifyTokenResult{Valid: true, User: botUser}
		}
	}

	msg := "Token không hợp lệ hoặc đã hết hạn."
	if err != nil {
		msg = err.Error()
	}
	utils.AddQuestLog("error", fmt.Sprintf("Token verification failed: %s", msg))
	return VerifyTokenResult{Valid: false, Error: msg}
}

type FetchQuestsResponse struct {
	Quests                      []QuestDTO `json:"quests"`
	QuestEnrollmentBlockedUntil *string    `json:"questEnrollmentBlockedUntil"`
}

func (s *QuestService) FetchQuests(ctx context.Context, token string) (*FetchQuestsResponse, error) {
	if strings.HasPrefix(strings.TrimSpace(token), "Bot ") {
		return &FetchQuestsResponse{
			Quests:                      []QuestDTO{},
			QuestEnrollmentBlockedUntil: nil,
		}, nil
	}

	cs := s.GetOrCreateClient(token)
	raw, err := cs.Rest.Get(ctx, "/quests/@me", nil)
	if err != nil {
		return nil, err
	}

	var allResp AllQuestsResponse
	if err := json.Unmarshal(raw, &allResp); err != nil {
		return nil, err
	}

	qm := FromResponse(ctx, cs.Rest, allResp, false)
	s.mu.Lock()
	cs.QuestManager = qm
	s.mu.Unlock()

	quests := qm.List()
	dtos := make([]QuestDTO, 0, len(quests))
	for _, q := range quests {
		dtos = append(dtos, q.ToDTO())
	}

	return &FetchQuestsResponse{
		Quests:                      dtos,
		QuestEnrollmentBlockedUntil: qm.QuestEnrollmentBlockedUntil,
	}, nil
}

func (s *QuestService) ensureQuestManager(ctx context.Context, token string) (*ClientSession, *QuestManager, error) {
	cs := s.GetOrCreateClient(token)
	s.mu.RLock()
	qm := cs.QuestManager
	s.mu.RUnlock()

	if qm == nil {
		if _, err := s.FetchQuests(ctx, token); err != nil {
			return nil, nil, err
		}
		s.mu.RLock()
		qm = cs.QuestManager
		s.mu.RUnlock()
	}
	if qm == nil {
		return nil, nil, fmt.Errorf("failed to initialize quest manager")
	}
	return cs, qm, nil
}

func (s *QuestService) EnrollQuest(ctx context.Context, token, questID string) (*QuestDTO, error) {
	_, qm, err := s.ensureQuestManager(ctx, token)
	if err != nil {
		return nil, err
	}
	quest := qm.Get(questID)
	if quest == nil {
		return nil, fmt.Errorf("Quest ID \"%s\" not found.", questID)
	}

	tasks := quest.Config().TaskConfigV2.Tasks
	_, hasMobile := tasks[TaskWatchVideoOnMobile]
	_, hasDesktop := tasks[TaskWatchVideo]
	isAndroid := hasMobile && !hasDesktop

	if _, err := qm.AcceptQuest(ctx, quest, isAndroid); err != nil {
		return nil, err
	}
	utils.AddQuestLog("success", fmt.Sprintf("Enrolled in quest \"%s\"", quest.Config().Messages.QuestName), questID)
	dto := quest.ToDTO()
	return &dto, nil
}

func (s *QuestService) pruneJobsLocked() {
	if len(s.jobs) <= maxJobsHistory {
		return
	}
	now := time.Now().UnixMilli()
	newOrder := make([]string, 0, len(s.jobOrder))
	for _, key := range s.jobOrder {
		job, ok := s.jobs[key]
		if !ok {
			continue
		}
		endTs := job.StartedAt
		if job.CompletedAt != nil {
			endTs = *job.CompletedAt
		}
		if len(s.jobs) > maxJobsHistory &&
			(job.Status == "completed" || job.Status == "cancelled" || job.Status == "error") &&
			(now-endTs > 3600000) {
			delete(s.jobs, key)
			continue
		}
		newOrder = append(newOrder, key)
	}
	s.jobOrder = newOrder
}

func (s *QuestService) StartQuest(ctx context.Context, token, questID string) (*QuestJob, error) {
	tokenKey := utils.HashToken(token)
	jobKey := fmt.Sprintf("%s:%s", tokenKey, questID)

	s.mu.Lock()
	s.pruneJobsLocked()
	if existing, ok := s.jobs[jobKey]; ok && (existing.Status == "running" || existing.Status == "enrolling") {
		cp := *existing
		s.mu.Unlock()
		return &cp, nil
	}
	s.mu.Unlock()

	_, qm, err := s.ensureQuestManager(ctx, token)
	if err != nil {
		return nil, err
	}
	quest := qm.Get(questID)
	if quest == nil {
		return nil, fmt.Errorf("Quest with ID %s was not found.", questID)
	}

	jobCtx, jobCancel := context.WithCancel(context.Background())
	questName := quest.Config().Messages.QuestName
	if questName == "" {
		questName = "Quest"
	}
	dto := quest.ToDTO()

	job := &QuestJob{
		QuestID:          questID,
		TokenKey:         tokenKey,
		TokenMasked:      utils.MaskToken(token),
		QuestName:        questName,
		TaskType:         dto.Task.Type,
		Status:           "idle",
		ProgressPercent:  dto.Task.ProgressPercent,
		CurrentSeconds:   dto.Task.CurrentSeconds,
		TargetSeconds:    dto.Task.TargetSeconds,
		RemainingMinutes: dto.Task.RemainingMinutes,
		Message:          "Starting quest...",
		StartedAt:        time.Now().UnixMilli(),
		Cancel:           jobCancel,
	}

	s.mu.Lock()
	if _, exists := s.jobs[jobKey]; !exists {
		s.jobOrder = append(s.jobOrder, jobKey)
	}
	s.jobs[jobKey] = job
	jobSnapshot := *job
	s.mu.Unlock()

	s.emit("job:update", jobSnapshot)

	go func() {
		defer func() {
			s.mu.RLock()
			finalSnap := *job
			s.mu.RUnlock()
			s.emit("job:update", finalSnap)
		}()

		err := qm.DoingQuest(jobCtx, quest, func(ev QuestProgressEvent) {
			s.mu.Lock()
			job.Status = ev.Status
			job.ProgressPercent = ev.ProgressPercent
			job.CurrentSeconds = ev.CurrentSeconds
			job.TargetSeconds = ev.TargetSeconds
			job.RemainingMinutes = ev.RemainingMinutes
			if ev.Message != "" {
				job.Message = ev.Message
			}
			snap := *job
			s.mu.Unlock()

			s.emit("job:progress", snap)
		})

		s.mu.Lock()
		if err != nil {
			job.Status = "error"
			job.Message = err.Error()
			now := time.Now().UnixMilli()
			job.CompletedAt = &now
			s.mu.Unlock()
			utils.AddQuestLog("error", fmt.Sprintf("Error in quest \"%s\": %v", questName, err), questID)
			return
		}

		if jobCtx.Err() == nil && job.Status != "error" && job.Status != "cancelled" {
			job.Status = "completed"
			job.ProgressPercent = 100
			job.RemainingMinutes = 0
			now := time.Now().UnixMilli()
			job.CompletedAt = &now
			job.Message = "Quest completed successfully!"
		}
		s.mu.Unlock()
	}()

	return &jobSnapshot, nil
}

func (s *QuestService) StopQuest(token, questID string) bool {
	tokenKey := utils.HashToken(token)
	jobKey := fmt.Sprintf("%s:%s", tokenKey, questID)

	s.mu.Lock()
	job, ok := s.jobs[jobKey]
	if !ok || (job.Status != "running" && job.Status != "enrolling" && job.Status != "idle") {
		s.mu.Unlock()
		return false
	}
	if job.Cancel != nil {
		job.Cancel()
	}
	job.Status = "cancelled"
	job.Message = "Cancelled by user request."
	now := time.Now().UnixMilli()
	job.CompletedAt = &now
	snap := *job
	s.mu.Unlock()

	s.emit("job:update", snap)
	return true
}

func (s *QuestService) StartAllQuests(ctx context.Context, token string) ([]QuestJob, error) {
	if _, err := s.FetchQuests(ctx, token); err != nil {
		return nil, err
	}
	_, qm, err := s.ensureQuestManager(ctx, token)
	if err != nil {
		return nil, err
	}
	valid := qm.FilterQuestsValidToDo()
	utils.AddQuestLog("info", fmt.Sprintf("Found %d valid quests to start for %s", len(valid), utils.MaskToken(token)))

	jobs := make([]QuestJob, 0, len(valid))
	for _, q := range valid {
		j, err := s.StartQuest(ctx, token, q.ID())
		if err == nil && j != nil {
			jobs = append(jobs, *j)
		}
		time.Sleep(500 * time.Millisecond)
	}
	return jobs, nil
}

func (s *QuestService) StopAllQuests(token string) int {
	tokenKey := utils.HashToken(token)
	prefix := tokenKey + ":"

	var stopped []QuestJob
	s.mu.Lock()
	for key, job := range s.jobs {
		if strings.HasPrefix(key, prefix) {
			if job.Status == "running" || job.Status == "enrolling" || job.Status == "idle" {
				if job.Cancel != nil {
					job.Cancel()
				}
				job.Status = "cancelled"
				job.Message = "Stopped as part of stop-all request."
				now := time.Now().UnixMilli()
				job.CompletedAt = &now
				stopped = append(stopped, *job)
			}
		}
	}
	s.mu.Unlock()

	for _, snap := range stopped {
		s.emit("job:update", snap)
	}
	return len(stopped)
}

func (s *QuestService) ClaimQuestReward(ctx context.Context, token, questID string) error {
	_, qm, err := s.ensureQuestManager(ctx, token)
	if err != nil {
		return err
	}
	quest := qm.Get(questID)
	if quest == nil {
		return fmt.Errorf("Quest ID \"%s\" not found.", questID)
	}
	return qm.RedeemQuest(ctx, quest, 0, nil)
}

func (s *QuestService) GetJobs(token string) []QuestJob {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filterKey := ""
	if strings.TrimSpace(token) != "" {
		filterKey = utils.HashToken(token)
	}

	out := make([]QuestJob, 0, len(s.jobOrder))
	for _, key := range s.jobOrder {
		job, ok := s.jobs[key]
		if !ok {
			continue
		}
		if filterKey != "" && job.TokenKey != filterKey {
			continue
		}
		out = append(out, *job)
	}
	return out
}

func (s *QuestService) StopAllRunningJobsGlobally() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	for _, job := range s.jobs {
		if job.Status == "running" || job.Status == "enrolling" || job.Status == "idle" {
			if job.Cancel != nil {
				job.Cancel()
			}
			job.Status = "cancelled"
			job.Message = "Terminated due to server shutdown."
			count++
		}
	}
	return count
}
