package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/database"
	questhandler "arychi-web/backend/internal/handlers/quest"
	streamhandler "arychi-web/backend/internal/handlers/stream"
	questsvc "arychi-web/backend/internal/services/quest"
	"arychi-web/backend/internal/utils"
)

func main() {
	mode := flag.String("mode", "all", "Server mode: all, quest, or stream")
	flag.Parse()

	config.LoadEnv()

	subMgr := database.NewSubscriptionManager()
	userMgr := database.NewUserManager()
	questService := questsvc.NewQuestService()

	questPort := 3001
	if p, err := strconv.Atoi(config.EnvOrDefault("PORT", "3001")); err == nil && p > 0 {
		questPort = p
	}

	var questSrv *questhandler.Server
	var streamSrv *streamhandler.Server
	var wg sync.WaitGroup

	if *mode == "all" || *mode == "quest" {
		questSrv = questhandler.NewServer(questPort, subMgr, userMgr, questService)
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := questSrv.Start(); err != nil {
				utils.QuestLogs.Error("Quest server error: %v", err)
			}
		}()
	}

	if *mode == "all" || *mode == "stream" {
		streamCfg := config.LoadStreamConfig()
		if streamCfg.ServerEnabled {
			streamSrv = streamhandler.NewServer(streamCfg, subMgr)
			wg.Add(1)
			go func() {
				defer wg.Done()
				if err := streamSrv.Start(); err != nil {
					utils.StreamLogs.Error("Stream server error: %v", err)
				}
			}()
		}
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh

	utils.QuestLogs.Info("Received %v. Shutting down gracefully...", sig)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if questSrv != nil {
		_ = questSrv.Shutdown(ctx)
	}
	if streamSrv != nil {
		_ = streamSrv.Shutdown(ctx)
	}
	subMgr.Close()
	wg.Wait()
}
