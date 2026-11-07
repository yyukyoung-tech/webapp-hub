@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. https://nodejs.org
  pause
  exit /b 1
)
set PORT=4317
node server.mjs --open
pause
