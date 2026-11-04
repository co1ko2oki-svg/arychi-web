package quest

import (
	"math"
	"sync"
	"time"

	"arychi-web/backend/internal/discord/rest"
)

const (
	TaskWatchVideo            = "WATCH_VIDEO"
	TaskWatchVideoOnMobile    = "WATCH_VIDEO_ON_MOBILE"
	TaskPlayOnDesktop         = "PLAY_ON_DESKTOP"
	TaskPlayOnDesktopV2       = "PLAY_ON_DESKTOP_V2"
	TaskPlayOnXbox            = "PLAY_ON_XBOX"
	TaskPlayOnPlaystation     = "PLAY_ON_PLAYSTATION"
	TaskStreamOnDesktop       = "STREAM_ON_DESKTOP"
	TaskPlayActivity          = "PLAY_ACTIVITY"
	TaskAchievementInActivity = "ACHIEVEMENT_IN_ACTIVITY"
)

var OrderedTaskNames = []string{
	TaskWatchVideo,
	TaskPlayOnDesktop,
	TaskPlayOnDesktopV2,
	TaskPlayOnXbox,
	TaskPlayOnPlaystation,
	TaskStreamOnDesktop,
	TaskPlayActivity,
	TaskWatchVideoOnMobile,
	TaskAchievementInActivity,
}

type QuestDTOApplication struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	IconURL *string `json:"iconUrl"`
}

type QuestDTOTask struct {
	Type             string `json:"type"`
	TargetSeconds    int    `json:"targetSeconds"`
	CurrentSeconds   int    `json:"currentSeconds"`
	ProgressPercent  int    `json:"progressPercent"`
	RemainingSeconds int    `json:"remainingSeconds"`
	RemainingMinutes int    `json:"remainingMinutes"`
}

type QuestDTORewards struct {
	Name     string  `json:"name"`
	AssetURL *string `json:"assetUrl"`
}

type QuestDTOAssets struct {
	Hero   *string `json:"hero"`
	Banner *string `json:"banner"`
}

type QuestDTOStatus struct {
	Enrolled  bool   `json:"enrolled"`
	Completed bool   `json:"completed"`
	Claimed   bool   `json:"claimed"`
	Expired   bool   `json:"expired"`
	ExpiresAt string `json:"expiresAt"`
}

type QuestDTO struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Application QuestDTOApplication `json:"application"`
	Task        QuestDTOTask        `json:"task"`
	Rewards     QuestDTORewards     `json:"rewards"`
	Assets      QuestDTOAssets      `json:"assets"`
	Status      QuestDTOStatus      `json:"status"`
}

type QuestTaskEntry struct {
	Type   string `json:"type"`
	Target int    `json:"target"`
}

type QuestConfigData struct {
	ID            string `json:"id"`
	StartsAt      string `json:"starts_at"`
	ExpiresAt     string `json:"expires_at"`
	ConfigVersion int    `json:"config_version"`
	Application   struct {
		ID   string  `json:"id"`
		Name string  `json:"name"`
		Icon *string `json:"icon"`
	} `json:"application"`
	Assets struct {
		Hero         *string `json:"hero"`
		QuestBarHero *string `json:"quest_bar_hero"`
		Banner       *string `json:"banner"`
	} `json:"assets"`
	Messages struct {
		QuestName string `json:"quest_name"`
	} `json:"messages"`
	TaskConfigV2 struct {
		Tasks map[string]QuestTaskEntry `json:"tasks"`
	} `json:"task_config_v2"`
	RewardsConfig struct {
		Platforms []int `json:"platforms"`
		Rewards   []struct {
			Name     string  `json:"name"`
			Asset    *string `json:"asset"`
			Messages struct {
				Name string `json:"name"`
			} `json:"messages"`
		} `json:"rewards"`
	} `json:"rewards_config"`
}

type QuestProgressValue struct {
	Value       float64 `json:"value"`
	CompletedAt *string `json:"completed_at"`
}

type QuestUserStatus struct {
	UserID      string                        `json:"user_id"`
	QuestID     string                        `json:"quest_id"`
	EnrolledAt  *string                       `json:"enrolled_at"`
	CompletedAt *string                       `json:"completed_at"`
	ClaimedAt   *string                       `json:"claimed_at"`
	Progress    map[string]QuestProgressValue `json:"progress"`
}

type QuestShape struct {
	ID                    string           `json:"id"`
	Config                QuestConfigData  `json:"config"`
	UserStatus            *QuestUserStatus `json:"user_status"`
	TargetedContent       interface{}      `json:"targeted_content"`
	Preview               bool             `json:"preview"`
	TrafficMetadataRaw    interface{}      `json:"traffic_metadata_raw,omitempty"`
	TrafficMetadataSealed interface{}      `json:"traffic_metadata_sealed,omitempty"`
}

type AllQuestsResponse struct {
	Quests                      []QuestShape `json:"quests"`
	ExcludedQuests              []struct {
		ID string `json:"id"`
	} `json:"excluded_quests"`
	QuestEnrollmentBlockedUntil *string `json:"quest_enrollment_blocked_until"`
}

type Quest struct {
	mu   sync.RWMutex
	data QuestShape
}

func CreateQuest(data QuestShape) *Quest {
	return &Quest{data: data}
}

func (q *Quest) ID() string {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.data.ID
}

func (q *Quest) Config() QuestConfigData {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.data.Config
}

func (q *Quest) UserStatus() *QuestUserStatus {
	q.mu.RLock()
	defer q.mu.RUnlock()
	if q.data.UserStatus == nil {
		return nil
	}
	cp := *q.data.UserStatus
	return &cp
}

func (q *Quest) Raw() QuestShape {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.data
}

func (q *Quest) UpdateUserStatus(us *QuestUserStatus) {
	if us == nil {
		return
	}
	q.mu.Lock()
	q.data.UserStatus = us
	q.mu.Unlock()
}

func (q *Quest) IsExpired(ref time.Time) bool {
	q.mu.RLock()
	expStr := q.data.Config.ExpiresAt
	q.mu.RUnlock()
	if expStr == "" {
		return false
	}
	exp, err := time.Parse(time.RFC3339, expStr)
	if err != nil {
		return false
	}
	return ref.After(exp)
}

func (q *Quest) IsCompleted() bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.data.UserStatus != nil && q.data.UserStatus.CompletedAt != nil && *q.data.UserStatus.CompletedAt != ""
}

func (q *Quest) IsEnrolledQuest() bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.data.UserStatus != nil && q.data.UserStatus.EnrolledAt != nil && *q.data.UserStatus.EnrolledAt != ""
}

func (q *Quest) HasClaimedRewards() bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.data.UserStatus != nil && q.data.UserStatus.ClaimedAt != nil && *q.data.UserStatus.ClaimedAt != ""
}

func (q *Quest) ToDTO() QuestDTO {
	q.mu.RLock()
	defer q.mu.RUnlock()

	cfg := q.data.Config
	tasks := cfg.TaskConfigV2.Tasks

	activeTaskName := "UNKNOWN"
	for _, name := range OrderedTaskNames {
		if _, ok := tasks[name]; ok {
			activeTaskName = name
			break
		}
	}

	targetSeconds := 0
	if activeTaskName != "UNKNOWN" {
		targetSeconds = tasks[activeTaskName].Target
	}

	currentSeconds := 0
	if q.data.UserStatus != nil && q.data.UserStatus.Progress != nil {
		if p, ok := q.data.UserStatus.Progress[activeTaskName]; ok {
			currentSeconds = int(p.Value)
		}
	}

	remainingSeconds := targetSeconds - currentSeconds
	if remainingSeconds < 0 {
		remainingSeconds = 0
	}

	progressPercent := 0
	if targetSeconds > 0 {
		progressPercent = int(math.Min(100, math.Round((float64(currentSeconds)/float64(targetSeconds))*100.0)))
	}

	appID := cfg.Application.ID
	iconURL := rest.GetAppIconURL(appID, cfg.Application.Icon)

	heroAsset := cfg.Assets.Hero
	if heroAsset == nil || *heroAsset == "" {
		heroAsset = cfg.Assets.QuestBarHero
	}
	bannerAsset := cfg.Assets.Banner
	if bannerAsset == nil || *bannerAsset == "" {
		bannerAsset = cfg.Assets.Hero
	}

	rewardName := "Reward"
	var rewardAsset *string
	if len(cfg.RewardsConfig.Rewards) > 0 {
		r0 := cfg.RewardsConfig.Rewards[0]
		if r0.Messages.Name != "" {
			rewardName = r0.Messages.Name
		} else if r0.Name != "" {
			rewardName = r0.Name
		}
		rewardAsset = r0.Asset
	}

	questName := cfg.Messages.QuestName
	if questName == "" {
		questName = "Unnamed Quest"
	}
	appName := cfg.Application.Name
	if appName == "" {
		appName = "Unknown Game"
	}

	enrolled := q.data.UserStatus != nil && q.data.UserStatus.EnrolledAt != nil && *q.data.UserStatus.EnrolledAt != ""
	completed := q.data.UserStatus != nil && q.data.UserStatus.CompletedAt != nil && *q.data.UserStatus.CompletedAt != ""
	claimed := q.data.UserStatus != nil && q.data.UserStatus.ClaimedAt != nil && *q.data.UserStatus.ClaimedAt != ""
	expired := false
	if cfg.ExpiresAt != "" {
		if exp, err := time.Parse(time.RFC3339, cfg.ExpiresAt); err == nil {
			expired = time.Now().After(exp)
		}
	}

	return QuestDTO{
		ID:   q.data.ID,
		Name: questName,
		Application: QuestDTOApplication{
			ID:      appID,
			Name:    appName,
			IconURL: iconURL,
		},
		Task: QuestDTOTask{
			Type:             activeTaskName,
			TargetSeconds:    targetSeconds,
			CurrentSeconds:   currentSeconds,
			ProgressPercent:  progressPercent,
			RemainingSeconds: remainingSeconds,
			RemainingMinutes: int(math.Ceil(float64(remainingSeconds) / 60.0)),
		},
		Rewards: QuestDTORewards{
			Name:     rewardName,
			AssetURL: rest.GetQuestAssetURL(q.data.ID, rewardAsset),
		},
		Assets: QuestDTOAssets{
			Hero:   rest.GetQuestAssetURL(q.data.ID, heroAsset),
			Banner: rest.GetQuestAssetURL(q.data.ID, bannerAsset),
		},
		Status: QuestDTOStatus{
			Enrolled:  enrolled,
			Completed: completed,
			Claimed:   claimed,
			Expired:   expired,
			ExpiresAt: cfg.ExpiresAt,
		},
	}
}
