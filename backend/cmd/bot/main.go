package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/discord/events"
	"arychi-web/backend/internal/discord/gateway"
	"arychi-web/backend/internal/discord/rest"
	questsvc "arychi-web/backend/internal/services/quest"
	"arychi-web/backend/internal/utils"
)

func main() {
	config.LoadEnv()
	token := strings.TrimSpace(os.Getenv("TOKEN"))
	if token == "" {
		token = strings.TrimSpace(os.Getenv("DISCORD_QUEST_TOKEN"))
	}
	if token == "" {
		fmt.Fprintln(os.Stderr, "Error: TOKEN is missing in environment variables or .env file.")
		os.Exit(1)
	}

	gw := gateway.NewClient(gateway.ClientOptions{
		Token:  token,
		Logger: utils.QuestLogs,
	})
	rc := rest.NewClient(token)

	doneCh := make(chan struct{})
	var once sync.Once

	gw.OnReady(func(r *events.ReadyData) {
		once.Do(func() {
			go func() {
				defer close(doneCh)
				if os.Getenv("GITHUB_ACTIONS") == "true" {
					fmt.Println("Logged in!")
				} else {
					fmt.Printf("Logged in as @%s (%s)\n", r.User.Username, r.User.ID)
				}

				raw, err := rc.Get(context.Background(), "/quests/@me", nil)
				if err != nil {
					utils.QuestLogs.Error("Failed to fetch quests: %v", err)
					return
				}
				var allResp questsvc.AllQuestsResponse
				if err := json.Unmarshal(raw, &allResp); err != nil {
					utils.QuestLogs.Error("Failed to parse quests: %v", err)
					return
				}

				qm := questsvc.FromResponse(context.Background(), rc, allResp, false)
				validQuests := qm.FilterQuestsValidToDo()
				fmt.Printf("Found %d valid quests to do.\n", len(validQuests))

				var wg sync.WaitGroup
				for _, q := range validQuests {
					questCopy := q
					wg.Add(1)
					go func() {
						defer wg.Done()
						_ = qm.DoingQuest(context.Background(), questCopy, nil)
					}()
				}
				wg.Wait()

				fmt.Println("All quests processed. Disconnecting...")
				gw.Close()
			}()
		})
	})

	if err := gw.Connect(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to Discord Gateway: %v\n", err)
		os.Exit(1)
	}

	<-doneCh
}
