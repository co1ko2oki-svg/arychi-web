#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [ ! -f "bin/quest-server" ]; then
  echo "[Build] Compiling quest-server..."
  go build -o bin/quest-server ./backend/cmd/quest
  chmod +x bin/quest-server
fi

./bin/quest-server
