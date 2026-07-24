@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"
if not exist "%ROOT%\.runtime" mkdir "%ROOT%\.runtime"
powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\serve-tsidkenu.ps1" -BindHost 127.0.0.1 -Port 3000 -PidFile "%ROOT%\.runtime\tsidkenu-server.pid"
