param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 3000,
  [switch]$Rebuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$pidFile = Join-Path $runtimeDir "tsidkenu-server.pid"
$launcherCmd = Join-Path $PSScriptRoot "launch-tsidkenu-local.cmd"
$healthUrl = "http://$BindHost`:$Port/"

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

function Test-ServerReady {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-ServerProcess {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

  $process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList @(
      "/c",
      "start",
      """TSIDEK Local Server""",
      "`"$launcherCmd`""
    ) `
    -WorkingDirectory $projectRoot `
    -PassThru

  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $pidFile) {
      $wrapperPid = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($wrapperPid) {
        return Get-Process -Id ([int]$wrapperPid) -ErrorAction SilentlyContinue
      }
    }
    Start-Sleep -Milliseconds 300
  }

  return $process
}

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPid) {
    $existingProcess = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
    if ($existingProcess -and (Test-ServerReady -Url $healthUrl)) {
      Start-Process $healthUrl
      Write-Host "TSIDEK is already running at $healthUrl"
      exit 0
    }

    if ($existingProcess) {
      Stop-Process -Id $existingProcess.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Set-Location $projectRoot

if ($Rebuild -or -not (Test-Path (Join-Path $projectRoot ".next\BUILD_ID"))) {
  & "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next" "build"
}

$process = Start-ServerProcess

$deadline = (Get-Date).AddSeconds(75)
while ((Get-Date) -lt $deadline) {
  if ($process -and $process.HasExited) {
    throw "TSIDEK local server launcher exited before the app became ready."
  }

  if (Test-ServerReady -Url $healthUrl) {
    Start-Process $healthUrl
    Write-Host "TSIDEK is live at $healthUrl"
    exit 0
  }

  Start-Sleep -Seconds 2
}

throw "TSIDEK did not become ready within 75 seconds. Keep the TSIDEK Local Server window open and inspect any startup errors shown there."
