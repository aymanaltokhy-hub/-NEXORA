@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this file again.
  pause & exit /b 1
)
if not exist node_modules (
  echo Installing dependencies, please wait...
  call npm install
  if errorlevel 1 ( echo npm install failed. Send me the text above. & pause & exit /b 1 )
)
if not exist dist\index.html (
  call npx vite build
  if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
)
call npx electron .
if errorlevel 1 ( echo NEXORA exited with an error. See %APPDATA%\nexora\crash.log & pause )
