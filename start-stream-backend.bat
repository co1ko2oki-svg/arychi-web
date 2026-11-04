@echo off
title Arychi Stream Backend (Golang Engine)
cd /d "%~dp0"
if not exist "bin\stream-server.exe" (
  echo [Build] Compiling stream-server...
  go build -o bin\stream-server.exe .\backend\cmd\stream
)
"bin\stream-server.exe"
