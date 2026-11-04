package database

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	_ "github.com/go-sql-driver/mysql"
)

const (
	PlanDaysPerMonth = 30
	PlanID           = "monthly_pro"
	PlanName         = "Gói Full Quyền Truy Cập"
)

type AccountTokens struct {
	QuestToken        string `json:"questToken"`
	StreamMainToken   string `json:"streamMainToken"`
	StreamViewerToken string `json:"streamViewerToken"`
	StreamGuildID     string `json:"streamGuildId,omitempty"`
	StreamChannelID   string `json:"streamChannelId,omitempty"`
	Prefix            string `json:"prefix,omitempty"`
	CommandChannelID  string `json:"commandChannelId,omitempty"`
	AdminIDs          string `json:"adminIds,omitempty"`
}

type AccountRecord struct {
	ID                    string        `json:"id"`
	Provider              string        `json:"provider"`
	Username              string        `json:"username"`
	Email                 string        `json:"email"`
	AvatarURL             *string       `json:"avatarUrl"`
	BotConnected          bool          `json:"botConnected"`
	SessionToken          string        `json:"sessionToken"`
	SubscriptionExpiresAt *string       `json:"subscriptionExpiresAt"`
	ActivatedAt           *string       `json:"activatedAt"`
	TotalMonthsPurchased  int           `json:"totalMonthsPurchased"`
	LicenseKey            *string       `json:"licenseKey"`
	Tokens                AccountTokens `json:"tokens"`
	Role                  string        `json:"role"`
	CreatedAt             string        `json:"createdAt"`
	UpdatedAt             string        `json:"updatedAt"`
}

type SubscriptionDatabaseSchema struct {
	Accounts []AccountRecord `json:"accounts"`
}

type SubscriptionStatusDTO struct {
	PlanID               string  `json:"planId"`
	PlanName             string  `json:"planName"`
	PriceLabel           string  `json:"priceLabel"`
	IsActive             bool    `json:"isActive"`
	DaysRemaining        int     `json:"daysRemaining"`
	TotalMonthsPurchased int     `json:"totalMonthsPurchased"`
	ActivatedAt          *string `json:"activatedAt"`
	ExpiresAt            *string `json:"expiresAt"`
	BotConnected         bool    `json:"botConnected"`
	LicenseKey           *string `json:"licenseKey"`
}

type SubscriptionManager struct {
	mu             sync.RWMutex
	dataDir        string
	dbFile         string
	bakFile        string
	pool           *sql.DB
	mysqlConnected bool
	db             SubscriptionDatabaseSchema
	httpClient     *http.Client
}

func NewSubscriptionManager(customDataDir ...string) *SubscriptionManager {
	var dataDir string
	if len(customDataDir) > 0 && customDataDir[0] != "" {
		dataDir = customDataDir[0]
	} else {
		root := config.ResolveWorkspaceRoot()
		dataDir = filepath.Join(root, "database")
	}
	_ = os.MkdirAll(dataDir, 0755)

	mgr := &SubscriptionManager{
		dataDir: dataDir,
		dbFile:  filepath.Join(dataDir, "commercial_db.json"),
		bakFile: filepath.Join(dataDir, "commercial_db.json.bak"),
		db: SubscriptionDatabaseSchema{
			Accounts: []AccountRecord{},
		},
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}

	mgr.loadLocalBackup()
	if len(customDataDir) == 0 {
		go mgr.initMySQL()
	}
	return mgr
}

func (m *SubscriptionManager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.pool != nil {
		_ = m.pool.Close()
		m.pool = nil
		m.mysqlConnected = false
	}
}

func (m *SubscriptionManager) initMySQL() {
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "root"
	}
	pass := os.Getenv("DB_PASSWORD")
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "3306"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "arychi_db"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=UTC", user, pass, host, port, dbName)
	pool, err := sql.Open("mysql", dsn)
	if err != nil {
		return
	}
	pool.SetMaxOpenConns(25)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxLifetime(5 * time.Minute)

	if err := pool.Ping(); err != nil {
		_ = pool.Close()
		return
	}

	m.mu.Lock()
	m.pool = pool
	m.mysqlConnected = true
	m.mu.Unlock()

	m.ensureTables()
	m.syncData()
}

func (m *SubscriptionManager) ensureTables() {
	m.mu.RLock()
	pool := m.pool
	connected := m.mysqlConnected
	m.mu.RUnlock()
	if pool == nil || !connected {
		return
	}

	schema := `
		CREATE TABLE IF NOT EXISTS accounts (
			id VARCHAR(64) NOT NULL PRIMARY KEY,
			provider VARCHAR(32) NOT NULL DEFAULT 'discord',
			username VARCHAR(128) NOT NULL,
			email VARCHAR(255) DEFAULT NULL,
			avatar_url TEXT DEFAULT NULL,
			bot_connected TINYINT(1) NOT NULL DEFAULT 0,
			session_token VARCHAR(128) NOT NULL UNIQUE,
			subscription_expires_at DATETIME DEFAULT NULL,
			activated_at DATETIME DEFAULT NULL,
			total_months_purchased INT NOT NULL DEFAULT 0,
			license_key VARCHAR(64) DEFAULT NULL,
			quest_token TEXT DEFAULT NULL,
			stream_main_token TEXT DEFAULT NULL,
			stream_viewer_token TEXT DEFAULT NULL,
			stream_guild_id VARCHAR(64) DEFAULT NULL,
			stream_channel_id VARCHAR(64) DEFAULT NULL,
			stream_prefix VARCHAR(16) DEFAULT '$',
			command_channel_id VARCHAR(64) DEFAULT NULL,
			admin_ids TEXT DEFAULT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_accounts_session (session_token),
			INDEX idx_accounts_username (username)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
	`
	_, _ = pool.Exec(schema)
}

func (m *SubscriptionManager) syncData() {
	m.mu.RLock()
	pool := m.pool
	connected := m.mysqlConnected
	m.mu.RUnlock()
	if pool == nil || !connected {
		return
	}

	var count int
	err := pool.QueryRow("SELECT COUNT(*) FROM accounts").Scan(&count)
	if err == nil && count > 0 {
		rows, err := pool.Query(`
			SELECT id, provider, username, COALESCE(email, ''), avatar_url, bot_connected,
			       session_token, subscription_expires_at, activated_at, total_months_purchased,
			       license_key, COALESCE(quest_token, ''), COALESCE(stream_main_token, ''),
			       COALESCE(stream_viewer_token, ''), COALESCE(stream_guild_id, ''),
			       COALESCE(stream_channel_id, ''), COALESCE(stream_prefix, '$'),
			       COALESCE(command_channel_id, ''), COALESCE(admin_ids, ''),
			       created_at, updated_at
			FROM accounts`)
		if err == nil {
			defer rows.Close()
			var accounts []AccountRecord
			for rows.Next() {
				var (
					a                                 AccountRecord
					email, avatarURL, licenseKey      sql.NullString
					subExp, actAt, createdAt, upAt    sql.NullTime
					botConn                           int
					qTok, sMain, sView, gID, cID, prf sql.NullString
					cmdID, admIDs                     sql.NullString
				)
				if err := rows.Scan(
					&a.ID, &a.Provider, &a.Username, &email, &avatarURL, &botConn,
					&a.SessionToken, &subExp, &actAt, &a.TotalMonthsPurchased,
					&licenseKey, &qTok, &sMain, &sView, &gID, &cID, &prf,
					&cmdID, &admIDs, &createdAt, &upAt,
				); err == nil {
					a.Email = email.String
					if avatarURL.Valid && avatarURL.String != "" {
						v := avatarURL.String
						a.AvatarURL = &v
					}
					a.BotConnected = botConn == 1
					if licenseKey.Valid && licenseKey.String != "" {
						v := licenseKey.String
						a.LicenseKey = &v
					}
					if subExp.Valid {
						s := subExp.Time.UTC().Format("2006-01-02T15:04:05.000Z")
						a.SubscriptionExpiresAt = &s
					}
					if actAt.Valid {
						s := actAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
						a.ActivatedAt = &s
					}
					if createdAt.Valid {
						a.CreatedAt = createdAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
					}
					if upAt.Valid {
						a.UpdatedAt = upAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
					}
					a.Tokens = AccountTokens{
						QuestToken:        qTok.String,
						StreamMainToken:   sMain.String,
						StreamViewerToken: sView.String,
						StreamGuildID:     gID.String,
						StreamChannelID:   cID.String,
						Prefix:            prf.String,
						CommandChannelID:  cmdID.String,
						AdminIDs:          admIDs.String,
					}
					m.enrichAccountRole(&a)
					accounts = append(accounts, a)
				}
			}
			if len(accounts) > 0 {
				m.mu.Lock()
				m.db.Accounts = accounts
				m.saveLocalBackupLocked()
				m.mu.Unlock()
			}
		}
	} else {
		m.mu.RLock()
		existingAccs := make([]AccountRecord, len(m.db.Accounts))
		copy(existingAccs, m.db.Accounts)
		m.mu.RUnlock()

		go func() {
			for _, acc := range existingAccs {
				m.sqlSaveAccount(acc)
			}
		}()
	}
}

func (m *SubscriptionManager) loadLocalBackup() {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := os.ReadFile(m.dbFile)
	if err != nil {
		data, err = os.ReadFile(m.bakFile)
		if err != nil {
			return
		}
	}

	var parsed SubscriptionDatabaseSchema
	if err := json.Unmarshal(data, &parsed); err == nil {
		if parsed.Accounts == nil {
			parsed.Accounts = []AccountRecord{}
		}
		for i := range parsed.Accounts {
			m.enrichAccountRole(&parsed.Accounts[i])
		}
		m.db = parsed
	}
}

func (m *SubscriptionManager) saveLocalBackupLocked() {
	_ = os.MkdirAll(m.dataDir, 0755)
	raw, err := json.MarshalIndent(m.db, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(m.bakFile, raw, 0644)
	_ = os.WriteFile(m.dbFile, raw, 0644)
}

func (m *SubscriptionManager) ReloadFromDisk() {
	m.loadLocalBackup()
}

func isoToSQLDateTime(iso *string) interface{} {
	if iso == nil || *iso == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, *iso)
	if err != nil {
		s := strings.ReplaceAll(*iso, "T", " ")
		if len(s) >= 19 {
			return s[:19]
		}
		return nil
	}
	return t.UTC().Format("2006-01-02 15:04:05")
}

func (m *SubscriptionManager) sqlSaveAccount(account AccountRecord) {
	m.mu.RLock()
	pool := m.pool
	connected := m.mysqlConnected
	m.mu.RUnlock()
	if pool == nil || !connected {
		return
	}

	createdAt := account.CreatedAt
	updatedAt := account.UpdatedAt
	botConn := 0
	if account.BotConnected {
		botConn = 1
	}
	prefix := account.Tokens.Prefix
	if prefix == "" {
		prefix = "$"
	}

	_, _ = pool.Exec(`
		INSERT INTO accounts (
			id, provider, username, email, avatar_url, bot_connected, session_token,
			subscription_expires_at, activated_at, total_months_purchased, license_key,
			quest_token, stream_main_token, stream_viewer_token, stream_guild_id, stream_channel_id,
			stream_prefix, command_channel_id, admin_ids,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			provider = VALUES(provider),
			username = VALUES(username),
			email = VALUES(email),
			avatar_url = VALUES(avatar_url),
			bot_connected = VALUES(bot_connected),
			session_token = VALUES(session_token),
			subscription_expires_at = VALUES(subscription_expires_at),
			activated_at = VALUES(activated_at),
			total_months_purchased = VALUES(total_months_purchased),
			license_key = VALUES(license_key),
			quest_token = VALUES(quest_token),
			stream_main_token = VALUES(stream_main_token),
			stream_viewer_token = VALUES(stream_viewer_token),
			stream_guild_id = VALUES(stream_guild_id),
			stream_channel_id = VALUES(stream_channel_id),
			stream_prefix = VALUES(stream_prefix),
			command_channel_id = VALUES(command_channel_id),
			admin_ids = VALUES(admin_ids),
			updated_at = NOW()
	`,
		account.ID,
		"discord",
		account.Username,
		nullIfEmpty(account.Email),
		account.AvatarURL,
		botConn,
		account.SessionToken,
		isoToSQLDateTime(account.SubscriptionExpiresAt),
		isoToSQLDateTime(account.ActivatedAt),
		account.TotalMonthsPurchased,
		account.LicenseKey,
		nullIfEmpty(account.Tokens.QuestToken),
		nullIfEmpty(account.Tokens.StreamMainToken),
		nullIfEmpty(account.Tokens.StreamViewerToken),
		nullIfEmpty(account.Tokens.StreamGuildID),
		nullIfEmpty(account.Tokens.StreamChannelID),
		prefix,
		nullIfEmpty(account.Tokens.CommandChannelID),
		nullIfEmpty(account.Tokens.AdminIDs),
		isoToSQLDateTime(&createdAt),
		isoToSQLDateTime(&updatedAt),
	)
}

func (m *SubscriptionManager) ComputeSubscriptionStatus(account *AccountRecord) *SubscriptionStatusDTO {
	if account == nil {
		return nil
	}
	now := time.Now()
	isActive := false
	daysRemaining := 0

	if account.SubscriptionExpiresAt != nil && *account.SubscriptionExpiresAt != "" {
		if expiry, err := time.Parse(time.RFC3339, *account.SubscriptionExpiresAt); err == nil {
			if expiry.After(now) {
				isActive = true
				diffHours := expiry.Sub(now).Hours()
				daysRemaining = int(math.Max(0, math.Ceil(diffHours/24.0)))
			}
		}
	} else if account.Role == "admin" || account.TotalMonthsPurchased > 0 {
		isActive = true
		daysRemaining = 365
	}

	totalMonths := account.TotalMonthsPurchased
	if totalMonths <= 0 {
		totalMonths = 1
	}

	return &SubscriptionStatusDTO{
		PlanID:               PlanID,
		PlanName:             PlanName,
		PriceLabel:           "Hoạt động",
		IsActive:             isActive,
		DaysRemaining:        daysRemaining,
		TotalMonthsPurchased: totalMonths,
		ActivatedAt:          account.ActivatedAt,
		ExpiresAt:            account.SubscriptionExpiresAt,
		BotConnected:         account.BotConnected,
		LicenseKey:           account.LicenseKey,
	}
}

type OAuthAccountInput struct {
	ID        string
	Provider  string
	Username  string
	Email     string
	AvatarURL *string
	Token     string
}

type UpsertOAuthInput = OAuthAccountInput

func (m *SubscriptionManager) UpsertOAuthAccount(input OAuthAccountInput) AccountRecord {
	m.mu.Lock()
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	provider := firstStr(input.Provider, "discord")

	existingIdx := -1
	for i, a := range m.db.Accounts {
		if a.ID == input.ID || (input.Email != "" && strings.EqualFold(a.Email, input.Email) && a.Provider == provider) {
			existingIdx = i
			break
		}
	}

	if existingIdx >= 0 {
		existing := m.db.Accounts[existingIdx]
		if input.Username != "" {
			existing.Username = input.Username
		}
		if input.Email != "" {
			existing.Email = input.Email
		}
		if input.AvatarURL != nil {
			existing.AvatarURL = input.AvatarURL
		}
		if input.Token != "" {
			existing.Tokens.QuestToken = input.Token
		}
		existing.BotConnected = true
		if existing.SessionToken == "" {
			existing.SessionToken = randomHex(24)
		}
		existing.UpdatedAt = now
		m.db.Accounts[existingIdx] = existing
		m.saveLocalBackupLocked()
		m.mu.Unlock()
		m.enrichAccountRole(&existing)
		go m.sqlSaveAccount(existing)
		return existing
	}

	email := input.Email
	if email == "" {
		email = fmt.Sprintf("%s@%s.oauth", input.Username, provider)
	}

	newAcc := AccountRecord{
		ID:           input.ID,
		Provider:     provider,
		Username:     input.Username,
		Email:        email,
		AvatarURL:    input.AvatarURL,
		BotConnected: true,
		SessionToken: randomHex(24),
		Role:         "user",
		Tokens: AccountTokens{
			QuestToken:        input.Token,
			StreamMainToken:   "",
			StreamViewerToken: "",
			StreamGuildID:     "",
			StreamChannelID:   "",
			Prefix:            "$",
			CommandChannelID:  "",
			AdminIDs:          "",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	m.db.Accounts = append(m.db.Accounts, newAcc)
	m.saveLocalBackupLocked()
	m.mu.Unlock()
	m.enrichAccountRole(&newAcc)
	go m.sqlSaveAccount(newAcc)
	return newAcc
}

func (m *SubscriptionManager) IsAdmin(acc *AccountRecord) bool {
	if acc == nil {
		return false
	}
	if strings.EqualFold(acc.Role, "admin") {
		return true
	}
	adminIDsEnv := os.Getenv("ADMIN_IDS")
	if adminIDsEnv != "" {
		for _, id := range config.ParseAdminIDs(adminIDsEnv) {
			if id != "" && (id == acc.ID || strings.EqualFold(id, acc.Username) || strings.EqualFold(id, acc.Email)) {
				return true
			}
		}
	}
	if acc.Tokens.AdminIDs != "" {
		for _, id := range config.ParseAdminIDs(acc.Tokens.AdminIDs) {
			if id != "" && (id == acc.ID || strings.EqualFold(id, acc.Username)) {
				return true
			}
		}
	}
	return false
}

func (m *SubscriptionManager) enrichAccountRole(acc *AccountRecord) {
	if acc == nil {
		return
	}
	if m.IsAdmin(acc) {
		acc.Role = "admin"
	} else if acc.Role == "" {
		acc.Role = "user"
	}
}

func (m *SubscriptionManager) GetAccountBySession(sessionToken string) *AccountRecord {
	clean := strings.TrimSpace(sessionToken)
	if len(clean) >= 7 && strings.EqualFold(clean[:7], "Bearer ") {
		clean = strings.TrimSpace(clean[7:])
	}
	if clean == "" {
		return nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, a := range m.db.Accounts {
		if a.SessionToken == clean {
			cp := a
			m.enrichAccountRole(&cp)
			return &cp
		}
	}
	return nil
}

func (m *SubscriptionManager) GetAccountByID(userID string) *AccountRecord {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, a := range m.db.Accounts {
		if a.ID == userID {
			cp := a
			m.enrichAccountRole(&cp)
			return &cp
		}
	}
	return nil
}

type TokenUpdateInput struct {
	QuestToken        *string
	StreamMainToken   *string
	StreamViewerToken *string
	StreamGuildID     *string
	StreamChannelID   *string
	Prefix            *string
	CommandChannelID  *string
	AdminIDs          *string
}

type AccountTokensUpdate = TokenUpdateInput

func (m *SubscriptionManager) UpdateAccountTokens(userID string, tokens TokenUpdateInput) *AccountRecord {
	m.mu.Lock()
	idx := -1
	for i, a := range m.db.Accounts {
		if a.ID == userID {
			idx = i
			break
		}
	}
	if idx == -1 {
		m.mu.Unlock()
		return nil
	}

	acc := m.db.Accounts[idx]
	if tokens.QuestToken != nil {
		acc.Tokens.QuestToken = strings.TrimSpace(*tokens.QuestToken)
	}
	if tokens.StreamMainToken != nil {
		acc.Tokens.StreamMainToken = strings.TrimSpace(*tokens.StreamMainToken)
	}
	if tokens.StreamViewerToken != nil {
		acc.Tokens.StreamViewerToken = strings.TrimSpace(*tokens.StreamViewerToken)
	}
	if tokens.StreamGuildID != nil {
		acc.Tokens.StreamGuildID = strings.TrimSpace(*tokens.StreamGuildID)
	}
	if tokens.StreamChannelID != nil {
		acc.Tokens.StreamChannelID = strings.TrimSpace(*tokens.StreamChannelID)
	}
	if tokens.Prefix != nil {
		acc.Tokens.Prefix = strings.TrimSpace(*tokens.Prefix)
	}
	if tokens.CommandChannelID != nil {
		acc.Tokens.CommandChannelID = strings.TrimSpace(*tokens.CommandChannelID)
	}
	if tokens.AdminIDs != nil {
		acc.Tokens.AdminIDs = strings.TrimSpace(*tokens.AdminIDs)
	}

	acc.UpdatedAt = time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	m.db.Accounts[idx] = acc
	m.saveLocalBackupLocked()
	m.mu.Unlock()

	go m.sqlSaveAccount(acc)
	return &acc
}

func (m *SubscriptionManager) UpdateFirstAccountStreamTokens(mainToken, viewerToken string, guildID, videoChanID, prefix, cmdChanID, adminIDs *string) {
	m.mu.Lock()
	if len(m.db.Accounts) == 0 {
		m.mu.Unlock()
		return
	}
	acc := m.db.Accounts[0]
	acc.Tokens.StreamMainToken = mainToken
	acc.Tokens.StreamViewerToken = viewerToken
	if guildID != nil && *guildID != "" {
		acc.Tokens.StreamGuildID = *guildID
	}
	if videoChanID != nil && *videoChanID != "" {
		acc.Tokens.StreamChannelID = *videoChanID
	}
	if prefix != nil && *prefix != "" {
		acc.Tokens.Prefix = *prefix
	}
	if cmdChanID != nil && *cmdChanID != "" {
		acc.Tokens.CommandChannelID = *cmdChanID
	}
	if adminIDs != nil && *adminIDs != "" {
		acc.Tokens.AdminIDs = *adminIDs
	}
	acc.UpdatedAt = time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	m.db.Accounts[0] = acc
	m.saveLocalBackupLocked()
	m.mu.Unlock()

	go m.sqlSaveAccount(acc)
}

type GrantSubscriptionResult struct {
	Account      AccountRecord
	Subscription SubscriptionStatusDTO
}

func (m *SubscriptionManager) GrantSubscription(userID string, months int, customLicenseKey string) *GrantSubscriptionResult {
	if months < 1 {
		months = 1
	}

	m.mu.Lock()
	accIdx := -1
	for i, a := range m.db.Accounts {
		if a.ID == userID {
			accIdx = i
			break
		}
	}
	if accIdx == -1 {
		m.mu.Unlock()
		return nil
	}

	acc := m.db.Accounts[accIdx]
	now := time.Now().UTC()
	nowISO := now.Format("2006-01-02T15:04:05.000Z")

	baseTime := now
	if acc.SubscriptionExpiresAt != nil && *acc.SubscriptionExpiresAt != "" {
		if curExp, err := time.Parse(time.RFC3339, *acc.SubscriptionExpiresAt); err == nil && curExp.After(now) {
			baseTime = curExp
		}
	}
	newExp := baseTime.Add(time.Duration(months*PlanDaysPerMonth*24) * time.Hour).UTC().Format("2006-01-02T15:04:05.000Z")

	if acc.ActivatedAt == nil || *acc.ActivatedAt == "" {
		act := nowISO
		acc.ActivatedAt = &act
	}
	acc.SubscriptionExpiresAt = &newExp
	acc.TotalMonthsPurchased += months
	acc.BotConnected = true
	if acc.LicenseKey == nil || *acc.LicenseKey == "" || customLicenseKey != "" {
		key := customLicenseKey
		if key == "" {
			key = generateLicenseKey(acc.ID)
		}
		acc.LicenseKey = &key
	}
	acc.UpdatedAt = nowISO
	m.db.Accounts[accIdx] = acc

	m.saveLocalBackupLocked()
	m.mu.Unlock()

	go m.sqlSaveAccount(acc)

	sub := m.ComputeSubscriptionStatus(&acc)
	return &GrantSubscriptionResult{
		Account:      acc,
		Subscription: *sub,
	}
}

func generateLicenseKey(accountID string) string {
	suffix := accountID
	if len(suffix) > 4 {
		suffix = suffix[len(suffix)-4:]
	}
	return fmt.Sprintf("ARYCHI-PRO-%s-%s", strings.ToUpper(suffix), strings.ToUpper(randomHex(2)))
}

func randomHex(byteLen int) string {
	b := make([]byte, byteLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func firstStr(val, def string) string {
	if strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return def
}

func nullIfEmpty(s string) interface{} {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
