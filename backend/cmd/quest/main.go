package main

import (
	"context"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/database"
	questhandler "arychi-web/backend/internal/handlers/quest"
	questsvc "arychi-web/backend/internal/services/quest"
	"arychi-web/backend/internal/utils"
)

func main() {
	config.LoadEnv()

	port := 3001
	if p, err := strconv.Atoi(config.EnvOrDefault("PORT", "3001")); err == nil && p > 0 {
		port = p
	}

	subMgr := database.NewSubscriptionManager()
	userMgr := database.NewUserManager()
	questService := questsvc.NewQuestService()

	srv := questhandler.NewServer(port, subMgr, userMgr, questService)

	go func() {
		if err := srv.Start(); err != nil {
			utils.QuestLogs.Error("Quest server error: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	utils.QuestLogs.Info("Received %v. Shutting down gracefully...", sig)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_ = srv.Shutdown(ctx)
	subMgr.Close()
	utils.QuestLogs.Info("HTTP and WebSocket server closed.")
}
