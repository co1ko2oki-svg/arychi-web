package quest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"net/url"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/discord/rest"
	"arychi-web/backend/internal/utils"
)

type QuestProgressEvent struct {
	QuestID          string `json:"questId"`
	QuestName        string `json:"questName"`
	TaskType         string `json:"taskType"`
	CurrentSeconds   int    `json:"currentSeconds"`
	TargetSeconds    int    `json:"targetSeconds"`
	ProgressPercent  int    `json:"progressPercent"`
	RemainingMinutes int    `json:"remainingMinutes"`
	Status           string `json:"status"`
	Message          string `json:"message,omitempty"`
}

type QuestProgressCallback func(event QuestProgressEvent)

type QuestManager struct {
	mu                           sync.RWMutex
	quests                       map[string]*Quest
	order                        []string
	client                       *rest.Client
	QuestEnrollmentBlockedUntil  *string
}

func NewQuestManager(client *rest.Client, quests []*Quest) *QuestManager {
	qm := &QuestManager{
		quests: make(map[string]*Quest, len(quests)),
		order:  make([]string, 0, len(quests)),
		client: client,
	}
	for _, q := range quests {
		qm.quests[q.ID()] = q
		qm.order = append(qm.order, q.ID())
	}
	return qm
}

func FromResponse(ctx context.Context, client *rest.Client, resp AllQuestsResponse, fetchExcluded bool) *QuestManager {
	if resp.QuestEnrollmentBlockedUntil != nil && *resp.QuestEnrollmentBlockedUntil != "" {
		utils.AddQuestLog("warn", fmt.Sprintf("Quest enrollment is blocked until %s.", *resp.QuestEnrollmentBlockedUntil))
	}
	quests := make([]*Quest, 0, len(resp.Quests))
	for _, qShape := range resp.Quests {
		quests = append(quests, CreateQuest(qShape))
	}
	qm := NewQuestManager(client, quests)
	qm.QuestEnrollmentBlockedUntil = resp.QuestEnrollmentBlockedUntil

	if fetchExcluded && len(resp.ExcludedQuests) > 0 {
		for _, ex := range resp.ExcludedQuests {
			if ex.ID != "" {
				_ = qm.addExcludedQuest(ctx, ex.ID)
			}
		}
	}
	return qm
}

func (qm *QuestManager) addExcludedQuest(ctx context.Context, questID string) error {
	raw, err := qm.client.Get(ctx, fmt.Sprintf("/quests/%s", questID), nil)
	if err != nil {
		utils.AddQuestLog("warn", fmt.Sprintf("Failed to fetch excluded quest \"%s\": %v", questID, err), questID)
		return err
	}
	var cfg QuestConfigData
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	q := CreateQuest(QuestShape{
		ID:              questID,
		Config:          cfg,
		UserStatus:      nil,
		TargetedContent: 0,
		Preview:         false,
	})
	utils.AddQuestLog("info", fmt.Sprintf("Added excluded quest \"%s\" to manager.", cfg.Messages.QuestName), questID)
	qm.Upsert(q)
	return nil
}

func (qm *QuestManager) List() []*Quest {
	qm.mu.RLock()
	defer qm.mu.RUnlock()
	out := make([]*Quest, 0, len(qm.order))
	for _, id := range qm.order {
		if q, ok := qm.quests[id]; ok {
			out = append(out, q)
		}
	}
	return out
}

func (qm *QuestManager) Get(id string) *Quest {
	qm.mu.RLock()
	defer qm.mu.RUnlock()
	return qm.quests[id]
}

func (qm *QuestManager) Upsert(q *Quest) {
	qm.mu.Lock()
	defer qm.mu.Unlock()
	if _, exists := qm.quests[q.ID()]; !exists {
		qm.order = append(qm.order, q.ID())
	}
	qm.quests[q.ID()] = q
}

func (qm *QuestManager) FilterQuestsValidToDo() []*Quest {
	now := time.Now()
	all := qm.List()
	out := make([]*Quest, 0, len(all))
	for _, q := range all {
		if !q.IsCompleted() && !q.IsExpired(now) {
			out = append(out, q)
		}
	}
	return out
}

func (qm *QuestManager) FilterQuestsValidToRedeem() []*Quest {
	all := qm.List()
	out := make([]*Quest, 0)
	for _, q := range all {
		if q.IsCompleted() && !q.HasClaimedRewards() {
			out = append(out, q)
		}
	}
	return out
}

func (qm *QuestManager) AcceptQuest(ctx context.Context, quest *Quest, isAndroid bool) (*Quest, error) {
	loc := 11
	androidHeader := "false"
	if isAndroid {
		loc = 12
		androidHeader = "true"
	}
	raw := quest.Raw()
	respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/enroll", quest.ID()), &rest.RequestOptions{
		Body: map[string]interface{}{
			"location":                loc,
			"is_targeted":             false,
			"metadata_sealed":         nil,
			"traffic_metadata_raw":    raw.TrafficMetadataRaw,
			"traffic_metadata_sealed": raw.TrafficMetadataSealed,
		},
		Headers: map[string]string{
			"AndroidRequest": androidHeader,
		},
	})
	if err != nil {
		return nil, err
	}
	var us QuestUserStatus
	if err := json.Unmarshal(respBytes, &us); err == nil {
		quest.UpdateUserStatus(&us)
		if existing := qm.Get(quest.ID()); existing != nil {
			existing.UpdateUserStatus(&us)
			return existing, nil
		}
	}
	return quest, nil
}

func (qm *QuestManager) RedeemQuest(ctx context.Context, quest *Quest, retry int, captchaHeaders map[string]string) error {
	questName := quest.Config().Messages.QuestName
	if retry >= 3 {
		utils.AddQuestLog("error", fmt.Sprintf("Failed to redeem quest \"%s\" after %d attempts.", questName, retry), quest.ID())
		return fmt.Errorf("failed to redeem quest after %d attempts", retry)
	}
	if !quest.IsCompleted() {
		utils.AddQuestLog("warn", fmt.Sprintf("Cannot redeem rewards for incomplete quest \"%s\".", questName), quest.ID())
		return nil
	}
	if quest.HasClaimedRewards() {
		utils.AddQuestLog("info", fmt.Sprintf("Rewards for quest \"%s\" already claimed.", questName), quest.ID())
		return nil
	}

	raw := quest.Raw()
	var platform interface{}
	if len(raw.Config.RewardsConfig.Platforms) > 0 {
		platform = raw.Config.RewardsConfig.Platforms[0]
	}

	respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/claim-reward", quest.ID()), &rest.RequestOptions{
		Body: map[string]interface{}{
			"platform":                platform,
			"location":                11,
			"is_targeted":             false,
			"metadata_raw":            nil,
			"metadata_sealed":         nil,
			"traffic_metadata_raw":    raw.TrafficMetadataRaw,
			"traffic_metadata_sealed": raw.TrafficMetadataSealed,
		},
		Headers: captchaHeaders,
	})
	if err != nil {
		var apiErr *rest.APIError
		if errors.As(err, &apiErr) && apiErr.Captcha != nil {
			utils.AddQuestLog("warn", fmt.Sprintf("Captcha required to redeem rewards for \"%s\".", questName), quest.ID())
			solvedKey, capErr := SolveCaptcha(ctx, apiErr.Captcha)
			if capErr != nil {
				utils.AddQuestLog("error", fmt.Sprintf("Captcha solving failed: %v", capErr), quest.ID())
				return capErr
			}
			return qm.RedeemQuest(ctx, quest, retry+1, map[string]string{
				"x-captcha-key":        solvedKey,
				"x-captcha-rqtoken":    apiErr.Captcha.CaptchaRqtoken,
				"x-captcha-session-id": apiErr.Captcha.CaptchaSessionID,
			})
		}
		utils.AddQuestLog("error", fmt.Sprintf("Failed to redeem rewards for \"%s\": %v", questName, err), quest.ID())
		return err
	}

	var us QuestUserStatus
	if json.Unmarshal(respBytes, &us) == nil {
		quest.UpdateUserStatus(&us)
	}
	utils.AddQuestLog("success", fmt.Sprintf("Claimed rewards for quest \"%s\"!", questName), quest.ID())
	return nil
}

func (qm *QuestManager) DoingQuest(ctx context.Context, quest *Quest, onProgress QuestProgressCallback) error {
	cfg := quest.Config()
	questName := cfg.Messages.QuestName
	tasks := cfg.TaskConfigV2.Tasks

	_, hasMobileVideo := tasks[TaskWatchVideoOnMobile]
	_, hasDesktopVideo := tasks[TaskWatchVideo]
	isAndroid := hasMobileVideo && !hasDesktopVideo

	if ctx.Err() != nil {
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:   quest.ID(),
				QuestName: questName,
				TaskType:  "UNKNOWN",
				Status:    "cancelled",
				Message:   "Task cancelled before start.",
			})
		}
		return nil
	}

	if !quest.IsEnrolledQuest() {
		platformLabel := "Desktop"
		if isAndroid {
			platformLabel = "Android"
		}
		utils.AddQuestLog("info", fmt.Sprintf("Enrolling in quest \"%s\" (%s)...", questName, platformLabel), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:   quest.ID(),
				QuestName: questName,
				TaskType:  "ENROLL",
				Status:    "enrolling",
				Message:   "Enrolling in quest...",
			})
		}
		if _, err := qm.AcceptQuest(ctx, quest, isAndroid); err != nil {
			utils.AddQuestLog("error", fmt.Sprintf("Failed to enroll in quest \"%s\": %v", questName, err), quest.ID())
			if onProgress != nil {
				onProgress(QuestProgressEvent{
					QuestID:   quest.ID(),
					QuestName: questName,
					TaskType:  "ENROLL",
					Status:    "error",
					Message:   fmt.Sprintf("Enrollment failed: %v", err),
				})
			}
			return nil
		}
	} else {
		utils.AddQuestLog("info", fmt.Sprintf("Already enrolled in quest \"%s\".", questName), quest.ID())
	}

	appName := cfg.Application.Name
	taskName := ""
	for _, name := range OrderedTaskNames {
		if _, ok := tasks[name]; ok {
			taskName = name
			break
		}
	}

	if taskName == "" {
		utils.AddQuestLog("warn", fmt.Sprintf("Unknown or unsupported task type for quest \"%s\".", questName), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:   quest.ID(),
				QuestName: questName,
				TaskType:  "UNKNOWN",
				Status:    "error",
				Message:   "Unsupported task type.",
			})
		}
		return nil
	}

	secondsNeeded := tasks[taskName].Target
	secondsDone := 0
	if us := quest.UserStatus(); us != nil && us.Progress != nil {
		if p, ok := us.Progress[taskName]; ok {
			secondsDone = int(p.Value)
		}
	}

	switch taskName {
	case TaskWatchVideo, TaskWatchVideoOnMobile:
		qm.doingWatchVideoQuest(ctx, quest, questName, secondsNeeded, secondsDone, isAndroid, onProgress)
	case TaskPlayOnXbox, TaskPlayOnPlaystation, TaskPlayOnDesktop, TaskPlayOnDesktopV2:
		qm.doingPlayOnPlatformQuest(ctx, quest, questName, secondsNeeded, taskName, appName, onProgress)
	case TaskPlayActivity:
		qm.doingPlayActivityQuest(ctx, quest, questName, secondsNeeded, taskName, appName, onProgress)
	case TaskStreamOnDesktop:
		utils.AddQuestLog("warn", fmt.Sprintf("STREAM_ON_DESKTOP is not supported via selfbot node. Complete in desktop app: %s", questName), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:        quest.ID(),
				QuestName:      questName,
				TaskType:       TaskStreamOnDesktop,
				CurrentSeconds: secondsDone,
				TargetSeconds:  secondsNeeded,
				Status:         "error",
				Message:        "STREAM_ON_DESKTOP requires Discord Desktop Client.",
			})
		}
	case TaskAchievementInActivity:
		qm.doingAchievementInActivityQuest(ctx, quest, questName, onProgress)
	default:
		utils.AddQuestLog("warn", fmt.Sprintf("Unsupported quest type. Use Discord app for: %s", questName), quest.ID())
	}

	return nil
}

func (qm *QuestManager) doingWatchVideoQuest(ctx context.Context, quest *Quest, questName string, secondsNeeded, initialSecondsDone int, isAndroid bool, onProgress QuestProgressCallback) {
	const (
		maxFuture = 10
		speed     = 7
		interval  = 7
	)

	enrolledAt := time.Now()
	if us := quest.UserStatus(); us != nil && us.EnrolledAt != nil && *us.EnrolledAt != "" {
		if parsed, err := time.Parse(time.RFC3339, *us.EnrolledAt); err == nil {
			enrolledAt = parsed
		}
	}

	secondsDone := initialSecondsDone
	completed := false
	consecutiveErrors := 0

	utils.AddQuestLog("info", fmt.Sprintf("Spoofing video watching for \"%s\" (%ds required).", questName, secondsNeeded), quest.ID())

	for {
		if ctx.Err() != nil {
			utils.AddQuestLog("warn", fmt.Sprintf("Watch video quest \"%s\" stopped by user.", questName), quest.ID())
			if onProgress != nil {
				pct := 0
				if secondsNeeded > 0 {
					pct = int(math.Min(100, math.Round((float64(secondsDone)/float64(secondsNeeded))*100)))
				}
				onProgress(QuestProgressEvent{
					QuestID:          quest.ID(),
					QuestName:        questName,
					TaskType:         TaskWatchVideo,
					CurrentSeconds:   secondsDone,
					TargetSeconds:    secondsNeeded,
					ProgressPercent:  pct,
					RemainingMinutes: int(math.Ceil(float64(secondsNeeded-secondsDone) / 60.0)),
					Status:           "cancelled",
					Message:          "Task stopped by user.",
				})
			}
			return
		}

		maxAllowed := int(time.Since(enrolledAt).Seconds()) + maxFuture
		diff := maxAllowed - secondsDone
		timestamp := secondsDone + speed

		if diff >= speed {
			tsFloat := math.Min(float64(secondsNeeded), float64(timestamp)+rand.Float64())
			reqOpts := &rest.RequestOptions{
				Body: map[string]interface{}{
					"timestamp": tsFloat,
				},
			}
			if isAndroid {
				reqOpts.Headers = map[string]string{
					"AndroidRequest": "true",
				}
			}
			respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/video-progress", quest.ID()), reqOpts)
			if err != nil {
				if strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "Unauthorized") {
					utils.AddQuestLog("error", fmt.Sprintf("Authentication error for \"%s\". Halting to protect account from lock.", questName), quest.ID())
					if onProgress != nil {
						onProgress(QuestProgressEvent{
							QuestID:   quest.ID(),
							QuestName: questName,
							TaskType:  TaskWatchVideo,
							Status:    "error",
							Message:   "Token Discord không hợp lệ hoặc đã hết hạn.",
						})
					}
					return
				}
				consecutiveErrors++
				utils.AddQuestLog("warn", fmt.Sprintf("Video progress error for \"%s\" (attempt %d/3): %v", questName, consecutiveErrors, err), quest.ID())
				if consecutiveErrors >= 3 {
					utils.AddQuestLog("error", fmt.Sprintf("Aborting video quest \"%s\" after 3 consecutive errors.", questName), quest.ID())
					if onProgress != nil {
						pct := 0
						if secondsNeeded > 0 {
							pct = int(math.Min(100, math.Round((float64(secondsDone)/float64(secondsNeeded))*100)))
						}
						onProgress(QuestProgressEvent{
							QuestID:          quest.ID(),
							QuestName:        questName,
							TaskType:         TaskWatchVideo,
							CurrentSeconds:   secondsDone,
							TargetSeconds:    secondsNeeded,
							ProgressPercent:  pct,
							RemainingMinutes: int(math.Ceil(float64(secondsNeeded-secondsDone) / 60.0)),
							Status:           "error",
							Message:          fmt.Sprintf("Failed after 3 network errors: %v", err),
						})
					}
					return
				}
			} else {
				consecutiveErrors = 0
				var us QuestUserStatus
				if json.Unmarshal(respBytes, &us) == nil {
					completed = us.CompletedAt != nil && *us.CompletedAt != ""
					quest.UpdateUserStatus(&us)
				}
				if timestamp < secondsNeeded {
					secondsDone = timestamp
				} else {
					secondsDone = secondsNeeded
				}
				pct := 0
				if secondsNeeded > 0 {
					pct = int(math.Min(100, math.Round((float64(secondsDone)/float64(secondsNeeded))*100)))
				}
				st := "running"
				if completed {
					st = "completed"
				}
				if onProgress != nil {
					onProgress(QuestProgressEvent{
						QuestID:          quest.ID(),
						QuestName:        questName,
						TaskType:         TaskWatchVideo,
						CurrentSeconds:   secondsDone,
						TargetSeconds:    secondsNeeded,
						ProgressPercent:  pct,
						RemainingMinutes: int(math.Ceil(float64(secondsNeeded-secondsDone) / 60.0)),
						Status:           st,
						Message:          fmt.Sprintf("Watching video: %d/%ds (%d%%)", secondsDone, secondsNeeded, pct),
					})
				}
			}
		}

		if timestamp >= secondsNeeded || completed {
			break
		}

		select {
		case <-ctx.Done():
		case <-time.After(interval * time.Second):
		}
	}

	if !completed && ctx.Err() == nil {
		reqOptsFinal := &rest.RequestOptions{
			Body: map[string]interface{}{"timestamp": secondsNeeded},
		}
		if isAndroid {
			reqOptsFinal.Headers = map[string]string{
				"AndroidRequest": "true",
			}
		}
		if respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/video-progress", quest.ID()), reqOptsFinal); err == nil {
			var us QuestUserStatus
			if json.Unmarshal(respBytes, &us) == nil {
				quest.UpdateUserStatus(&us)
			}
		}
	}

	utils.AddQuestLog("success", fmt.Sprintf("Quest \"%s\" completed!", questName), quest.ID())
	qm.client.EmitQuestCompleted(quest.ID())
	if onProgress != nil {
		onProgress(QuestProgressEvent{
			QuestID:          quest.ID(),
			QuestName:        questName,
			TaskType:         TaskWatchVideo,
			CurrentSeconds:   secondsNeeded,
			TargetSeconds:    secondsNeeded,
			ProgressPercent:  100,
			RemainingMinutes: 0,
			Status:           "completed",
			Message:          "Quest completed successfully!",
		})
	}
}

func (qm *QuestManager) doingPlayOnPlatformQuest(ctx context.Context, quest *Quest, questName string, secondsNeeded int, taskName, applicationName string, onProgress QuestProgressCallback) {
	const interval = 20
	consecutiveErrors := 0
	appID := quest.Config().Application.ID

	utils.AddQuestLog("info", fmt.Sprintf("Spoofing game play for \"%s\" (%s). Target: %d minutes.", questName, applicationName, int(math.Ceil(float64(secondsNeeded)/60.0))), quest.ID())

	for !quest.IsCompleted() {
		if ctx.Err() != nil {
			utils.AddQuestLog("warn", fmt.Sprintf("Stopping game spoofing for \"%s\"... Sending terminal heartbeat.", questName), quest.ID())
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_, _ = qm.client.Post(bgCtx, fmt.Sprintf("/quests/%s/heartbeat", quest.ID()), &rest.RequestOptions{
				Body: map[string]interface{}{
					"application_id": appID,
					"terminal":       true,
				},
			})
			cancel()

			cur := qm.getProgressSeconds(quest, taskName)
			pct := 0
			if secondsNeeded > 0 {
				pct = int(math.Min(100, math.Round((float64(cur)/float64(secondsNeeded))*100)))
			}
			if onProgress != nil {
				onProgress(QuestProgressEvent{
					QuestID:          quest.ID(),
					QuestName:        questName,
					TaskType:         taskName,
					CurrentSeconds:   cur,
					TargetSeconds:    secondsNeeded,
					ProgressPercent:  pct,
					RemainingMinutes: int(math.Ceil(float64(secondsNeeded-cur) / 60.0)),
					Status:           "cancelled",
					Message:          "Game spoofing stopped by user.",
				})
			}
			return
		}

		secondsDone := qm.getProgressSeconds(quest, taskName)

		respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/heartbeat", quest.ID()), &rest.RequestOptions{
			Body: map[string]interface{}{
				"application_id": appID,
				"terminal":       false,
			},
		})
		if err != nil {
			consecutiveErrors++
			utils.AddQuestLog("warn", fmt.Sprintf("Heartbeat error for \"%s\" (fail %d/5): %v", questName, consecutiveErrors, err), quest.ID())
			if consecutiveErrors >= 5 {
				utils.AddQuestLog("error", fmt.Sprintf("Aborting game spoofing for \"%s\" after 5 consecutive errors.", questName), quest.ID())
				if onProgress != nil {
					pct := 0
					if secondsNeeded > 0 {
						pct = int(math.Min(100, math.Round((float64(secondsDone)/float64(secondsNeeded))*100)))
					}
					onProgress(QuestProgressEvent{
						QuestID:          quest.ID(),
						QuestName:        questName,
						TaskType:         taskName,
						CurrentSeconds:   secondsDone,
						TargetSeconds:    secondsNeeded,
						ProgressPercent:  pct,
						RemainingMinutes: int(math.Ceil(float64(secondsNeeded-secondsDone) / 60.0)),
						Status:           "error",
						Message:          fmt.Sprintf("Heartbeat failed repeatedly: %v", err),
					})
				}
				return
			}
		} else {
			consecutiveErrors = 0
			var us QuestUserStatus
			if json.Unmarshal(respBytes, &us) == nil {
				quest.UpdateUserStatus(&us)
			}
		}

		currentDone := qm.getProgressSeconds(quest, taskName)
		if currentDone == 0 && secondsDone > 0 {
			currentDone = secondsDone
		}
		remainingMinutes := int(math.Max(0, math.Ceil(float64(secondsNeeded-currentDone)/60.0)))
		progressPercent := 0
		if secondsNeeded > 0 {
			progressPercent = int(math.Min(100, math.Round((float64(currentDone)/float64(secondsNeeded))*100)))
		}

		utils.AddQuestLog("info", fmt.Sprintf("Spoofing game [%s]: %d/%dm (%d%%). Remaining: %dm",
			applicationName, currentDone/60, int(math.Ceil(float64(secondsNeeded)/60.0)), progressPercent, remainingMinutes), quest.ID())

		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:          quest.ID(),
				QuestName:        questName,
				TaskType:         taskName,
				CurrentSeconds:   currentDone,
				TargetSeconds:    secondsNeeded,
				ProgressPercent:  progressPercent,
				RemainingMinutes: remainingMinutes,
				Status:           "running",
				Message:          fmt.Sprintf("Playing %s: %d/%d min (%d%%)", applicationName, currentDone/60, int(math.Ceil(float64(secondsNeeded)/60.0)), progressPercent),
			})
		}

		if quest.IsCompleted() || currentDone >= secondsNeeded {
			break
		}

		select {
		case <-ctx.Done():
		case <-time.After(interval * time.Second):
		}
	}

	if respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/heartbeat", quest.ID()), &rest.RequestOptions{
		Body: map[string]interface{}{
			"application_id": appID,
			"terminal":       true,
		},
	}); err == nil {
		var us QuestUserStatus
		if json.Unmarshal(respBytes, &us) == nil {
			quest.UpdateUserStatus(&us)
		}
	}

	utils.AddQuestLog("success", fmt.Sprintf("Quest \"%s\" completed!", questName), quest.ID())
	qm.client.EmitQuestCompleted(quest.ID())
	if onProgress != nil {
		onProgress(QuestProgressEvent{
			QuestID:          quest.ID(),
			QuestName:        questName,
			TaskType:         taskName,
			CurrentSeconds:   secondsNeeded,
			TargetSeconds:    secondsNeeded,
			ProgressPercent:  100,
			RemainingMinutes: 0,
			Status:           "completed",
			Message:          "Quest completed successfully!",
		})
	}
}

func (qm *QuestManager) doingPlayActivityQuest(ctx context.Context, quest *Quest, questName string, secondsNeeded int, taskName, applicationName string, onProgress QuestProgressCallback) {
	const (
		interval  = 20
		streamKey = "call:1:1"
	)
	consecutiveErrors := 0

	utils.AddQuestLog("info", fmt.Sprintf("Spoofing activity for \"%s\" (%s). Target: %d minutes.", questName, applicationName, int(math.Ceil(float64(secondsNeeded)/60.0))), quest.ID())

	for !quest.IsCompleted() {
		if ctx.Err() != nil {
			utils.AddQuestLog("warn", fmt.Sprintf("Stopping activity spoofing for \"%s\"...", questName), quest.ID())
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			_, _ = qm.client.Post(bgCtx, fmt.Sprintf("/quests/%s/heartbeat", quest.ID()), &rest.RequestOptions{
				Body: map[string]interface{}{
					"stream_key": streamKey,
					"terminal":   true,
				},
			})
			cancel()

			cur := qm.getProgressSeconds(quest, taskName)
			if onProgress != nil {
				onProgress(QuestProgressEvent{
					QuestID:        quest.ID(),
					QuestName:      questName,
					TaskType:       taskName,
					CurrentSeconds: cur,
					TargetSeconds:  secondsNeeded,
					Status:         "cancelled",
					Message:        "Activity stopped by user.",
				})
			}
			return
		}

		secondsDone := qm.getProgressSeconds(quest, taskName)

		respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/heartbeat", quest.ID()), &rest.RequestOptions{
			Body: map[string]interface{}{
				"stream_key": streamKey,
				"terminal":   false,
			},
		})
		if err != nil {
			consecutiveErrors++
			utils.AddQuestLog("warn", fmt.Sprintf("Activity heartbeat error for \"%s\" (fail %d/5): %v", questName, consecutiveErrors, err), quest.ID())
			if consecutiveErrors >= 5 {
				utils.AddQuestLog("error", fmt.Sprintf("Aborting activity quest \"%s\" after 5 consecutive errors.", questName), quest.ID())
				if onProgress != nil {
					pct := 0
					if secondsNeeded > 0 {
						pct = int(math.Min(100, math.Round((float64(secondsDone)/float64(secondsNeeded))*100)))
					}
					onProgress(QuestProgressEvent{
						QuestID:          quest.ID(),
						QuestName:        questName,
						TaskType:         taskName,
						CurrentSeconds:   secondsDone,
						TargetSeconds:    secondsNeeded,
						ProgressPercent:  pct,
						RemainingMinutes: int(math.Ceil(float64(secondsNeeded-secondsDone) / 60.0)),
						Status:           "error",
						Message:          fmt.Sprintf("Activity heartbeat failed: %v", err),
					})
				}
				return
			}
		} else {
			consecutiveErrors = 0
			var us QuestUserStatus
			if json.Unmarshal(respBytes, &us) == nil {
				quest.UpdateUserStatus(&us)
			}
		}

		currentDone := qm.getProgressSeconds(quest, taskName)
		if currentDone == 0 && secondsDone > 0 {
			currentDone = secondsDone
		}
		remainingMinutes := int(math.Max(0, math.Ceil(float64(secondsNeeded-currentDone)/60.0)))
		progressPercent := 0
		if secondsNeeded > 0 {
			progressPercent = int(math.Min(100, math.Round((float64(currentDone)/float64(secondsNeeded))*100)))
		}

		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:          quest.ID(),
				QuestName:        questName,
				TaskType:         taskName,
				CurrentSeconds:   currentDone,
				TargetSeconds:    secondsNeeded,
				ProgressPercent:  progressPercent,
				RemainingMinutes: remainingMinutes,
				Status:           "running",
				Message:          fmt.Sprintf("Activity %s: %d/%d min (%d%%)", applicationName, currentDone/60, int(math.Ceil(float64(secondsNeeded)/60.0)), progressPercent),
			})
		}

		if quest.IsCompleted() || currentDone >= secondsNeeded {
			break
		}

		select {
		case <-ctx.Done():
		case <-time.After(interval * time.Second):
		}
	}

	if respBytes, err := qm.client.Post(ctx, fmt.Sprintf("/quests/%s/heartbeat", quest.ID()), &rest.RequestOptions{
		Body: map[string]interface{}{
			"stream_key": streamKey,
			"terminal":   true,
		},
	}); err == nil {
		var us QuestUserStatus
		if json.Unmarshal(respBytes, &us) == nil {
			quest.UpdateUserStatus(&us)
		}
	}

	utils.AddQuestLog("success", fmt.Sprintf("Quest \"%s\" completed!", questName), quest.ID())
	qm.client.EmitQuestCompleted(quest.ID())
	if onProgress != nil {
		onProgress(QuestProgressEvent{
			QuestID:          quest.ID(),
			QuestName:        questName,
			TaskType:         taskName,
			CurrentSeconds:   secondsNeeded,
			TargetSeconds:    secondsNeeded,
			ProgressPercent:  100,
			RemainingMinutes: 0,
			Status:           "completed",
			Message:          "Quest completed successfully!",
		})
	}
}

func (qm *QuestManager) doingAchievementInActivityQuest(ctx context.Context, quest *Quest, questName string, onProgress QuestProgressCallback) {
	cfg := quest.Config()
	appID := cfg.Application.ID
	appName := cfg.Application.Name
	questTarget := cfg.TaskConfigV2.Tasks[TaskAchievementInActivity].Target

	if ctx.Err() != nil {
		return
	}

	if onProgress != nil {
		onProgress(QuestProgressEvent{
			QuestID:          quest.ID(),
			QuestName:        questName,
			TaskType:         TaskAchievementInActivity,
			CurrentSeconds:   0,
			TargetSeconds:    questTarget,
			ProgressPercent:  10,
			RemainingMinutes: 1,
			Status:           "running",
			Message:          fmt.Sprintf("Authorizing application %s...", appName),
		})
	}

	query := url.Values{}
	query.Set("response_type", "code")
	query.Set("client_id", appID)
	query.Set("scope", "identify applications.commands applications.entitlements")
	query.Set("state", "")

	respBytes, err := qm.client.Post(ctx, "/oauth2/authorize", &rest.RequestOptions{
		Query: query,
		Body: map[string]interface{}{
			"permissions":      "0",
			"authorize":        true,
			"integration_type": 1,
			"location_context": map[string]interface{}{
				"guild_id":     "10000",
				"channel_id":   "10000",
				"channel_type": 10000,
			},
		},
	})
	if err != nil {
		utils.AddQuestLog("error", fmt.Sprintf("Error executing activity quest \"%s\": %v", questName, err), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:       quest.ID(),
				QuestName:     questName,
				TaskType:      TaskAchievementInActivity,
				TargetSeconds: questTarget,
				Status:        "error",
				Message:       fmt.Sprintf("Unexpected error: %v", err),
			})
		}
		return
	}

	var authRes struct {
		Location string `json:"location"`
	}
	_ = json.Unmarshal(respBytes, &authRes)
	var authCode string
	if authRes.Location != "" {
		if parsedURL, err := url.Parse(authRes.Location); err == nil {
			authCode = parsedURL.Query().Get("code")
		}
	}

	if authCode == "" {
		utils.AddQuestLog("error", fmt.Sprintf("No auth code received for %s. Cannot complete quest.", appName), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:       quest.ID(),
				QuestName:     questName,
				TaskType:      TaskAchievementInActivity,
				TargetSeconds: questTarget,
				Status:        "error",
				Message:       "No auth code received from Discord OAuth.",
			})
		}
		return
	}

	if ctx.Err() != nil {
		return
	}

	saysToken, activityRef, err := qm.client.AuthorizeDiscordSays(ctx, appID, quest.ID(), authCode)
	if err != nil || saysToken == "" {
		utils.AddQuestLog("error", fmt.Sprintf("Failed to authorize with Discord Says for %s: %v", appName, err), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:       quest.ID(),
				QuestName:     questName,
				TaskType:      TaskAchievementInActivity,
				TargetSeconds: questTarget,
				Status:        "error",
				Message:       fmt.Sprintf("Discord Says authorization failed: %v", err),
			})
		}
		return
	}

	if err := qm.client.ProgressDiscordSays(ctx, appID, quest.ID(), saysToken, questTarget, activityRef); err != nil {
		utils.AddQuestLog("error", fmt.Sprintf("Failed to progress quest with Discord Says for %s: %v", appName, err), quest.ID())
		if onProgress != nil {
			onProgress(QuestProgressEvent{
				QuestID:       quest.ID(),
				QuestName:     questName,
				TaskType:      TaskAchievementInActivity,
				TargetSeconds: questTarget,
				Status:        "error",
				Message:       fmt.Sprintf("Progress update failed: %v", err),
			})
		}
		return
	}

	if tokBytes, err := qm.client.Get(ctx, "/oauth2/tokens", nil); err == nil {
		var tokens []struct {
			ID          string `json:"id"`
			Application struct {
				ID string `json:"id"`
			} `json:"application"`
		}
		if json.Unmarshal(tokBytes, &tokens) == nil {
			for _, t := range tokens {
				if t.Application.ID == appID {
					_, _ = qm.client.Delete(ctx, fmt.Sprintf("/oauth2/tokens/%s", t.ID), nil)
					utils.AddQuestLog("info", fmt.Sprintf("Deauthorized application %s", appName), quest.ID())
					break
				}
			}
		}
	}

	utils.AddQuestLog("success", fmt.Sprintf("Quest \"%s\" completed!", questName), quest.ID())
	qm.client.EmitQuestCompleted(quest.ID())
	if onProgress != nil {
		onProgress(QuestProgressEvent{
			QuestID:          quest.ID(),
			QuestName:        questName,
			TaskType:         TaskAchievementInActivity,
			CurrentSeconds:   questTarget,
			TargetSeconds:    questTarget,
			ProgressPercent:  100,
			RemainingMinutes: 0,
			Status:           "completed",
			Message:          "Quest completed successfully!",
		})
	}
}

func (qm *QuestManager) getProgressSeconds(quest *Quest, taskName string) int {
	if us := quest.UserStatus(); us != nil && us.Progress != nil {
		if p, ok := us.Progress[taskName]; ok {
			return int(p.Value)
		}
	}
	return 0
}
