package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/database"
	streamhandler "arychi-web/backend/internal/handlers/stream"
	"arychi-web/backend/internal/utils"
)

func main() {
	config.LoadEnv()

	streamCfg := config.LoadStreamConfig()
	subMgr := database.NewSubscriptionManager()
	srv := streamhandler.NewServer(streamCfg, subMgr)

	go func() {
		if err := srv.Start(); err != nil {
			utils.StreamLogs.Error("Stream server error: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	utils.StreamLogs.Info("Received %v. Shutting down gracefully...", sig)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_ = srv.Shutdown(ctx)
	subMgr.Close()
}
