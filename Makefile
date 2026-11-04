.PHONY: help build test frontend-build build-all clean

help:
	@echo "Arychi Web Suite Commands:"
	@echo "  make build          Build Go backend binaries"
	@echo "  make test           Run backend unit tests"
	@echo "  make frontend-build Build frontend for production"
	@echo "  make build-all      Build both backend and frontend"
	@echo "  make clean          Clean bin/ and frontend/dist/"

build:
	@mkdir -p bin
	go build -o bin/quest-server ./backend/cmd/quest
	go build -o bin/stream-server ./backend/cmd/stream
	go build -o bin/arychi-server ./backend/cmd/server
	go build -o bin/quest-bot ./backend/cmd/bot
	go build -o bin/spoofer ./backend/cmd/spoofer
	@chmod +x bin/* 2>/dev/null || true

test:
	go test -v ./backend/tests/...

frontend-build:
	npm --prefix frontend run build

build-all: build frontend-build

clean:
	rm -rf bin/* frontend/dist
