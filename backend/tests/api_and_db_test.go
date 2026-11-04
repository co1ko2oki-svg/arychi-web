package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/database"
	questhandler "arychi-web/backend/internal/handlers/quest"
	streamhandler "arychi-web/backend/internal/handlers/stream"
	questsvc "arychi-web/backend/internal/services/quest"
)

func TestUserManager(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "users_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	mgr := database.NewUserManager(tempDir)

	// Initially empty
	users := mgr.GetAllUsers()
	if len(users) != 0 {
		t.Fatalf("expected 0 users initially, got %d", len(users))
	}

	// Save user
	avatar := "https://cdn.discordapp.com/avatar.png"
	saved := mgr.SaveUser(database.StoredUser{
		ID:            "user_123",
		Username:      "arychi_test",
		Discriminator: "0",
		AvatarURL:     &avatar,
		Token:         "mfa.test_token_12345",
		Type:          "user",
		Bot:           false,
	})

	if saved.ID != "user_123" || saved.Username != "arychi_test" {
		t.Fatalf("unexpected saved user data: %+v", saved)
	}

	// Retrieve user
	u := mgr.GetUserByID("user_123")
	if u == nil || u.Username != "arychi_test" {
		t.Fatalf("expected to find user_123, got: %+v", u)
	}

	// Set active user
	mgr.SetActiveUser("user_123")
	active := mgr.GetActiveUser()
	if active == nil || active.ID != "user_123" {
		t.Fatalf("expected active user to be user_123, got: %+v", active)
	}

	// Verify persistence from disk
	mgr2 := database.NewUserManager(tempDir)
	u2 := mgr2.GetUserByID("user_123")
	if u2 == nil || u2.Token != "mfa.test_token_12345" {
		t.Fatalf("expected persisted user to be retrieved, got: %+v", u2)
	}
}

func TestSubscriptionManagerLocal(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "sub_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	subMgr := database.NewSubscriptionManager(tempDir)

	// Upsert account
	avatar := "avatar_url"
	acc := subMgr.UpsertOAuthAccount(database.OAuthAccountInput{
		ID:        "acc_999",
		Provider:  "discord",
		Username:  "streamer_pro",
		Email:     "pro@arychi.xyz",
		AvatarURL: &avatar,
		Token:     "oauth_token_val",
	})

	if acc.ID != "acc_999" || acc.SessionToken == "" {
		t.Fatalf("unexpected account: %+v", acc)
	}

	// Subscription status (initially inactive without purchase)
	status := subMgr.ComputeSubscriptionStatus(&acc)
	if status == nil {
		t.Fatalf("expected status DTO, got nil")
	}
	if status.IsActive {
		t.Fatalf("expected new account not to be active without paid plan")
	}

	// Update tokens
	qTok := "token_quest_abc"
	sTok := "token_stream_xyz"
	updated := subMgr.UpdateAccountTokens(acc.ID, database.TokenUpdateInput{
		QuestToken:      &qTok,
		StreamMainToken: &sTok,
	})
	if updated == nil || updated.Tokens.QuestToken != qTok || updated.Tokens.StreamMainToken != sTok {
		t.Fatalf("unexpected updated account tokens: %+v", updated)
	}

	// Account lookup by session
	bySess := subMgr.GetAccountBySession(acc.SessionToken)
	if bySess == nil || bySess.ID != "acc_999" {
		t.Fatalf("expected to find account by session token")
	}

	// Account lookup by ID
	byID := subMgr.GetAccountByID("acc_999")
	if byID == nil || byID.Username != "streamer_pro" {
		t.Fatalf("expected to find account by ID")
	}
}

func TestQuestServerAPIEndpoints(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "quest_api_test_*")
	defer os.RemoveAll(tempDir)

	subMgr := database.NewSubscriptionManager(tempDir)
	userMgr := database.NewUserManager(tempDir)
	qSvc := questsvc.NewQuestService()

	srv := questhandler.NewServer(3001, subMgr, userMgr, qSvc)

	// 1. GET /api/subscription/verify (unauthenticated)
	req1 := httptest.NewRequest(http.MethodGet, "/api/subscription/verify", nil)
	rec1 := httptest.NewRecorder()
	srv.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for subscription verify, got %d", rec1.Code)
	}
	var res1 map[string]any
	if err := json.Unmarshal(rec1.Body.Bytes(), &res1); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if res1["verified"] != false {
		t.Fatalf("expected unverified session, got: %v", res1["verified"])
	}

	// 2. GET /api/logs without admin auth should return 403 Forbidden
	req2Unauthorized := httptest.NewRequest(http.MethodGet, "/api/logs", nil)
	rec2Unauthorized := httptest.NewRecorder()
	srv.ServeHTTP(rec2Unauthorized, req2Unauthorized)
	if rec2Unauthorized.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unauthorized /api/logs, got %d", rec2Unauthorized.Code)
	}

	// GET /api/logs with admin key should return 200 OK
	os.Setenv("ADMIN_KEY", "test-admin-secret")
	defer os.Unsetenv("ADMIN_KEY")
	req2 := httptest.NewRequest(http.MethodGet, "/api/logs", nil)
	req2.Header.Set("X-Admin-Key", "test-admin-secret")
	rec2 := httptest.NewRecorder()
	srv.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin /api/logs, got %d", rec2.Code)
	}
	var res2 map[string]any
	if err := json.Unmarshal(rec2.Body.Bytes(), &res2); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if _, ok := res2["logs"]; !ok {
		t.Fatalf("expected 'logs' key in response, got: %+v", res2)
	}

	// 3. GET /api/auth/users
	req3 := httptest.NewRequest(http.MethodGet, "/api/auth/users", nil)
	rec3 := httptest.NewRecorder()
	srv.ServeHTTP(rec3, req3)

	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/auth/users, got %d", rec3.Code)
	}
	var res3 map[string]any
	if err := json.Unmarshal(rec3.Body.Bytes(), &res3); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if users, ok := res3["users"].([]any); !ok || len(users) != 0 {
		t.Fatalf("expected empty users array, got: %v", res3["users"])
	}
}

func TestStreamServerAPIEndpoints(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "stream_api_test_*")
	defer os.RemoveAll(tempDir)

	subMgr := database.NewSubscriptionManager(tempDir)
	cfg := config.NewStreamConfig()
	cfg.VideosDir = filepath.Join(tempDir, "videos")
	_ = os.MkdirAll(cfg.VideosDir, 0755)

	srv := streamhandler.NewServer(cfg, subMgr)

	// 1. GET /api/status
	req1 := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	rec1 := httptest.NewRecorder()
	srv.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/status, got %d", rec1.Code)
	}
	var res1 map[string]any
	if err := json.Unmarshal(rec1.Body.Bytes(), &res1); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if _, ok := res1["stream"]; !ok {
		t.Fatalf("expected 'stream' field in status response")
	}

	// 2. GET /api/queue
	req2 := httptest.NewRequest(http.MethodGet, "/api/queue", nil)
	rec2 := httptest.NewRecorder()
	srv.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/queue, got %d", rec2.Code)
	}
	var res2 map[string]any
	if err := json.Unmarshal(rec2.Body.Bytes(), &res2); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if items, ok := res2["items"].([]any); !ok || len(items) != 0 {
		t.Fatalf("expected empty queue items, got: %v", res2["items"])
	}

	// 3. GET /api/farm
	req3 := httptest.NewRequest(http.MethodGet, "/api/farm", nil)
	rec3 := httptest.NewRecorder()
	srv.ServeHTTP(rec3, req3)

	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/farm, got %d", rec3.Code)
	}
	var res3 map[string]any
	if err := json.Unmarshal(rec3.Body.Bytes(), &res3); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	if _, ok := res3["isWatching"]; !ok {
		t.Fatalf("expected 'isWatching' in viewer status")
	}
}
