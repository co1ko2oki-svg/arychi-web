package main

import (
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	"arychi-web/backend/internal/services/spoofer"
)

func parseCLIArgs(rawArgs []string) *spoofer.CLIArgs {
	args := &spoofer.CLIArgs{
		Threads: 2,
	}

	for i := 0; i < len(rawArgs); i++ {
		arg := rawArgs[i]
		switch {
		case arg == "--hours" && i+1 < len(rawArgs):
			i++
			if v, err := strconv.ParseFloat(rawArgs[i], 64); err == nil {
				args.Hours = &v
			}
		case strings.HasPrefix(arg, "--hours="):
			if v, err := strconv.ParseFloat(strings.TrimPrefix(arg, "--hours="), 64); err == nil {
				args.Hours = &v
			}
		case arg == "--threads" && i+1 < len(rawArgs):
			i++
			if v, err := strconv.Atoi(rawArgs[i]); err == nil && v > 0 {
				args.Threads = v
			}
		case strings.HasPrefix(arg, "--threads="):
			if v, err := strconv.Atoi(strings.TrimPrefix(arg, "--threads=")); err == nil && v > 0 {
				args.Threads = v
			}
		case arg == "--games" && i+1 < len(rawArgs):
			i++
			if v, err := strconv.Atoi(rawArgs[i]); err == nil {
				args.Games = &v
			}
		case strings.HasPrefix(arg, "--games="):
			if v, err := strconv.Atoi(strings.TrimPrefix(arg, "--games=")); err == nil {
				args.Games = &v
			}
		case arg == "--mark-played":
			val := 1000
			if i+1 < len(rawArgs) && !strings.HasPrefix(rawArgs[i+1], "--") {
				if parsed, err := strconv.Atoi(rawArgs[i+1]); err == nil {
					val = parsed
					i++
				}
			}
			args.MarkPlayed = &val
		case strings.HasPrefix(arg, "--mark-played="):
			val := 1000
			if parsed, err := strconv.Atoi(strings.TrimPrefix(arg, "--mark-played=")); err == nil {
				val = parsed
			}
			args.MarkPlayed = &val
		case arg == "--token" && i+1 < len(rawArgs):
			i++
			args.Token = rawArgs[i]
		case strings.HasPrefix(arg, "--token="):
			args.Token = strings.TrimPrefix(arg, "--token=")
		case arg == "--cookie" && i+1 < len(rawArgs):
			i++
			args.Cookie = rawArgs[i]
		case strings.HasPrefix(arg, "--cookie="):
			args.Cookie = strings.TrimPrefix(arg, "--cookie=")
		}
	}

	return args
}

func main() {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		spoofer.NewConsole().Warn("exit", "interrupted")
		os.Exit(0)
	}()

	cliArgs := parseCLIArgs(os.Args[1:])
	spoofer.NewApp().Start(cliArgs)
}
