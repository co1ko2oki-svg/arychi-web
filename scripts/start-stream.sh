#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [ ! -f "bin/stream-server" ]; then
  echo "[Build] Compiling stream-server..."
  go build -o bin/stream-server ./backend/cmd/stream
  chmod +x bin/stream-server
fi

./bin/stream-server
