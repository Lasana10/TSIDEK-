Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$pidFile = Join-Path $runtimeDir "tsidkenu-server.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "No tracked TSIDEK local server was found."
  exit 0
}

$pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pidValue) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "Removed stale TSIDEK pid file."
  exit 0
}

$process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $process.Id -Force
  Write-Host "Stopped TSIDEK local server process $($process.Id)."
} else {
  Write-Host "Removed stale TSIDEK pid file."
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
