@echo off
chcp 65001 >nul
title Arychi Web Suite v2.0 - Unified Runner
cd /d "%~dp0"
node launcher.mjs
if %errorlevel% neq 0 (
  pause
)
