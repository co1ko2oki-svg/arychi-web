@echo off
title Arychi Quest Backend (Golang Engine)
cd /d "%~dp0.."
if not exist "bin\quest-server.exe" (
  echo [Build] Compiling quest-server...
  go build -o bin\quest-server.exe .\backend\cmd\quest
)
"bin\quest-server.exe"
