@echo off
chcp 65001 >nul
title Arychi Web Suite (Go Native Backend)
cd /d "%~dp0"
node launcher.mjs
if %errorlevel% neq 0 (
  pause
)
