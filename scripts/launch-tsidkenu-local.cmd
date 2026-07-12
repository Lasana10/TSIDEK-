@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\serve-tsidkenu.ps1" -BindHost 127.0.0.1 -Port 3000
