package database

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/utils"
)

type StoredUser struct {
	ID            string  `json:"id"`
	Username      string  `json:"username"`
	Discriminator string  `json:"discriminator,omitempty"`
	AvatarURL     *string `json:"avatarUrl"`
	Email         string  `json:"email,omitempty"`
	Token         string  `json:"token"`
	Type          string  `json:"type"`
	Bot           bool    `json:"bot"`
	CreatedAt     string  `json:"createdAt"`
	LastActiveAt  string  `json:"lastActiveAt"`
}

type SaveUserInput = StoredUser

type UsersDatabase struct {
	ActiveUserID *string      `json:"activeUserId"`
	Users        []StoredUser `json:"users"`
}

type UserManager struct {
	mu        sync.RWMutex
	dataDir   string
	usersFile string
	db        UsersDatabase
}

func NewUserManager(customDataDir ...string) *UserManager {
	var dataDir string
	if len(customDataDir) > 0 && customDataDir[0] != "" {
		dataDir = customDataDir[0]
	} else {
		root := config.ResolveWorkspaceRoot()
		dataDir = filepath.Join(root, "database")
	}
	_ = os.MkdirAll(dataDir, 0755)

	um := &UserManager{
		dataDir:   dataDir,
		usersFile: filepath.Join(dataDir, "users.json"),
		db: UsersDatabase{
			ActiveUserID: nil,
			Users:        []StoredUser{},
		},
	}
	um.init()
	return um
}

func (u *UserManager) init() {
	u.mu.Lock()
	defer u.mu.Unlock()

	if data, err := os.ReadFile(u.usersFile); err == nil {
		var parsed UsersDatabase
		if err := json.Unmarshal(data, &parsed); err == nil {
			if parsed.Users == nil {
				parsed.Users = []StoredUser{}
			}
			u.db = parsed
			return
		}
	}
	u.saveToFileLocked()
}

func (u *UserManager) saveToFileLocked() {
	_ = os.MkdirAll(u.dataDir, 0755)
	data, err := json.MarshalIndent(u.db, "", "  ")
	if err != nil {
		utils.AddQuestLog("error", fmt.Sprintf("Failed to write users database: %v", err))
		return
	}
	if err := os.WriteFile(u.usersFile, data, 0644); err != nil {
		utils.AddQuestLog("error", fmt.Sprintf("Failed to write users database: %v", err))
	}
}

func (u *UserManager) GetAllUsers() []StoredUser {
	u.mu.RLock()
	defer u.mu.RUnlock()
	out := make([]StoredUser, len(u.db.Users))
	copy(out, u.db.Users)
	return out
}

func (u *UserManager) GetActiveUser() *StoredUser {
	u.mu.RLock()
	defer u.mu.RUnlock()

	if len(u.db.Users) == 0 {
		return nil
	}
	if u.db.ActiveUserID == nil || *u.db.ActiveUserID == "" {
		cp := u.db.Users[0]
		return &cp
	}
	for _, usr := range u.db.Users {
		if usr.ID == *u.db.ActiveUserID {
			cp := usr
			return &cp
		}
	}
	cp := u.db.Users[0]
	return &cp
}

func (u *UserManager) GetUserByID(id string) *StoredUser {
	u.mu.RLock()
	defer u.mu.RUnlock()
	for _, usr := range u.db.Users {
		if usr.ID == id {
			cp := usr
			return &cp
		}
	}
	return nil
}

func (u *UserManager) SaveUser(user StoredUser) StoredUser {
	u.mu.Lock()
	defer u.mu.Unlock()

	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	if user.Type == "" {
		if user.Bot {
			user.Type = "bot"
		} else {
			user.Type = "user"
		}
	}

	existingIdx := -1
	for i, existing := range u.db.Users {
		if existing.ID == user.ID {
			existingIdx = i
			break
		}
	}

	var saved StoredUser
	if existingIdx >= 0 {
		prev := u.db.Users[existingIdx]
		saved = user
		if saved.CreatedAt == "" {
			saved.CreatedAt = prev.CreatedAt
		}
		saved.LastActiveAt = now
		u.db.Users[existingIdx] = saved
		utils.AddQuestLog("info", fmt.Sprintf("Updated user in database: @%s (%s) [%s]", saved.Username, saved.ID, strings.ToUpper(saved.Type)))
	} else {
		saved = user
		if saved.CreatedAt == "" {
			saved.CreatedAt = now
		}
		saved.LastActiveAt = now
		u.db.Users = append(u.db.Users, saved)
		utils.AddQuestLog("success", fmt.Sprintf("Saved new user into database: @%s (%s) [%s]", saved.Username, saved.ID, strings.ToUpper(saved.Type)))
	}

	activeID := saved.ID
	u.db.ActiveUserID = &activeID
	u.saveToFileLocked()
	return saved
}

func (u *UserManager) SetActiveUser(id string) *StoredUser {
	u.mu.Lock()
	defer u.mu.Unlock()

	for i, usr := range u.db.Users {
		if usr.ID == id {
			now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
			u.db.Users[i].LastActiveAt = now
			activeID := id
			u.db.ActiveUserID = &activeID
			u.saveToFileLocked()
			cp := u.db.Users[i]
			utils.AddQuestLog("info", fmt.Sprintf("Switched active user in database to @%s (%s)", cp.Username, cp.ID))
			return &cp
		}
	}
	return nil
}

func (u *UserManager) DeleteUser(id string) bool {
	u.mu.Lock()
	defer u.mu.Unlock()

	idx := -1
	for i, usr := range u.db.Users {
		if usr.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return false
	}

	deleted := u.db.Users[idx]
	u.db.Users = append(u.db.Users[:idx], u.db.Users[idx+1:]...)
	if u.db.ActiveUserID != nil && *u.db.ActiveUserID == id {
		if len(u.db.Users) > 0 {
			firstID := u.db.Users[0].ID
			u.db.ActiveUserID = &firstID
		} else {
			u.db.ActiveUserID = nil
		}
	}
	u.saveToFileLocked()
	utils.AddQuestLog("warn", fmt.Sprintf("Removed user from database: @%s (%s)", deleted.Username, deleted.ID))
	return true
}
