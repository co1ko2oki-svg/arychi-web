@echo off
title Arychi Stream Backend (Node StreamBot)
cd /d "%~dp0..\stream"
node --experimental-websocket dist\index.js
