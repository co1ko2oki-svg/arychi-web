@echo off
chcp 65001 >nul
title Biên dịch Arychi Go Backend
cd /d "%~dp0.."

echo [1/5] Dang build quest-server...
go build -o bin/quest-server.exe ./backend/cmd/quest
if %errorlevel% neq 0 goto error

echo [2/5] Dang build stream-server...
go build -o bin/stream-server.exe ./backend/cmd/stream
if %errorlevel% neq 0 goto error

echo [3/5] Dang build arychi-server...
go build -o bin/arychi-server.exe ./backend/cmd/server
if %errorlevel% neq 0 goto error

echo [4/5] Dang build quest-bot...
go build -o bin/quest-bot.exe ./backend/cmd/bot
if %errorlevel% neq 0 goto error

echo [5/5] Dang build spoofer...
go build -o bin/spoofer.exe ./backend/cmd/spoofer
if %errorlevel% neq 0 goto error

echo.
echo ===========================================
echo  Bien dich tat ca dich vu Go thanh cong!
echo  Cac file .exe da duoc cap nhat vao bin/
echo ===========================================
echo.
pause
exit /b 0

:error
echo.
echo [LOI] Bien dich that bai! Vui long kiem tra code Go.
pause
exit /b 1
