param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 3000,
  [string]$PidFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if ($PidFile) {
  Set-Content -Path $PidFile -Value $PID
}

& "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next" "start" "-H" $BindHost "-p" $Port
