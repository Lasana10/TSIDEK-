param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 3000,
  [string]$PidFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
Set-Location $projectRoot

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

if (-not $PidFile) {
  $PidFile = Join-Path $runtimeDir "tsidkenu-server.pid"
}

if ($PidFile) {
  Set-Content -Path $PidFile -Value $PID
}

try {
  & "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next" "start" "-H" $BindHost "-p" $Port
} finally {
  if ($PidFile -and (Test-Path $PidFile)) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}
