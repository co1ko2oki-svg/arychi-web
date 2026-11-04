#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

mkdir -p bin

echo "[1/5] Building quest-server (Linux)..."
go build -o bin/quest-server ./backend/cmd/quest
chmod +x bin/quest-server

echo "[2/5] Building stream-server (Linux)..."
go build -o bin/stream-server ./backend/cmd/stream
chmod +x bin/stream-server

echo "[3/5] Building arychi-server (Linux)..."
go build -o bin/arychi-server ./backend/cmd/server
chmod +x bin/arychi-server

echo "[4/5] Building quest-bot (Linux)..."
go build -o bin/quest-bot ./backend/cmd/bot
chmod +x bin/quest-bot

echo "[5/5] Building spoofer (Linux)..."
go build -o bin/spoofer ./backend/cmd/spoofer
chmod +x bin/spoofer

echo "=========================================="
echo " Build Go thanh cong tren Linux! (bin/*)"
echo "=========================================="
