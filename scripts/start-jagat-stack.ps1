param(
  [switch]$Restart,
  [int]$BackendPort = 5000,
  [int]$UiPort = 50012
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$UiRoot = Join-Path $Root "jagat-ui"
$LogDir = Join-Path $Root "ops\runtime-logs"
$QdrantExe = "C:\Users\Administrator\Downloads\qdrant-x86_64-pc-windows-msvc\qdrant.exe"
$QdrantStoragePath = "C:\JAGAT\qdrant_data"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# -- Qdrant Auto-Start --------------------------------------------------------
function Start-Qdrant {
  $running = Get-Process qdrant -ErrorAction SilentlyContinue
  if ($running) {
    # Verify it is actually responding on port 6333
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:6333/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      Write-Host "Qdrant already running and responding (PID $($running.Id))"
      return
    } catch {
      Write-Warning "Qdrant process exists but not responding - killing and restarting..."
      $running | Stop-Process -Force
      Start-Sleep 2
    }
  }

  if (-not (Test-Path $QdrantExe)) {
    Write-Warning "Qdrant executable not found at: $QdrantExe - skipping Qdrant start"
    return
  }

  Write-Host "Starting Qdrant with storage: $QdrantStoragePath"
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $QdrantExe
  $psi.WorkingDirectory = (Split-Path $QdrantExe -Parent)
  $psi.UseShellExecute = $false
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $psi.EnvironmentVariables["QDRANT__STORAGE__STORAGE_PATH"] = $QdrantStoragePath
  $proc = [System.Diagnostics.Process]::Start($psi)
  Write-Host "Qdrant started (PID $($proc.Id)) - waiting for readiness..."

  # Wait up to 30 seconds for Qdrant to be ready
  $attempts = 0
  $maxAttempts = 10
  while ($attempts -lt $maxAttempts) {
    Start-Sleep 3
    $attempts++
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:6333/collections" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      Write-Host "Qdrant is READY ($attempts attempt(s))"
      return
    } catch {
      Write-Host "Qdrant not ready yet - attempt $attempts/$maxAttempts"
    }
  }
  Write-Warning "Qdrant did not become ready within 30 seconds - check logs"
}
# -----------------------------------------------------------------------------

function Stop-PortProcess {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" }

  foreach ($connection in $connections) {
    try {
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
      Write-Host "Stopped process $($connection.OwningProcess) on port $Port"
    } catch {
      Write-Warning "Failed to stop process $($connection.OwningProcess) on port ${Port}: $($_.Exception.Message)"
    }
  }
}

function Test-Http {
  param(
    [string]$Url,
    [int]$TimeoutSec = 5
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing
    return $response.StatusCode
  } catch {
    return $null
  }
}

function Start-NodeProcess {
  param(
    [string]$WorkingDirectory,
    [string]$Arguments,
    [string]$OutLog,
    [string]$ErrLog
  )

  Start-Process `
    -FilePath "node" `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog | Out-Null
}

function Invoke-ScheduledTaskOrFallback {
  param(
    [string]$TaskName,
    [string]$WorkingDirectory,
    [string]$Arguments,
    [string]$OutLog,
    [string]$ErrLog,
    [int]$Port
  )

  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    # Stop first if running, then re-start for clean state
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Restarted scheduled task: $TaskName"
  } else {
    # Fallback: start as hidden process
    Start-NodeProcess -WorkingDirectory $WorkingDirectory -Arguments $Arguments -OutLog $OutLog -ErrLog $ErrLog
    Write-Host "Started node process (no scheduled task) on port $Port"
  }
}

if ($Restart) {
  Stop-PortProcess -Port $BackendPort
  Stop-PortProcess -Port $UiPort
  Start-Sleep -Seconds 1
}

# ── Start Qdrant first (memory layer dependency) ─────────────────────────────
Start-Qdrant

Set-Location $Root
if (-not (Test-Path (Join-Path $Root "dist\index.js"))) {
  Write-Host "Backend dist missing; running npm run build..."
  npm run build
}

if (-not (Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" })) {
  Invoke-ScheduledTaskOrFallback `
    -TaskName "JAGAT-Backend-5000" `
    -WorkingDirectory $Root `
    -Arguments "dist/index.js" `
    -OutLog (Join-Path $LogDir "backend-$BackendPort.out.log") `
    -ErrLog (Join-Path $LogDir "backend-$BackendPort.err.log") `
    -Port $BackendPort
} else {
  Write-Host "Backend already listening on port $BackendPort"
}

Set-Location $UiRoot
if (-not (Test-Path (Join-Path $UiRoot ".next\BUILD_ID"))) {
  Write-Host "UI build missing; running npm run build..."
  npm run build
}

if (-not (Get-NetTCPConnection -LocalPort $UiPort -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" })) {
  Invoke-ScheduledTaskOrFallback `
    -TaskName "JAGAT-UI-50012" `
    -WorkingDirectory $UiRoot `
    -Arguments "node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port $UiPort" `
    -OutLog (Join-Path $LogDir "ui-$UiPort.out.log") `
    -ErrLog (Join-Path $LogDir "ui-$UiPort.err.log") `
    -Port $UiPort
} else {
  Write-Host "UI already listening on port $UiPort"
}

Set-Location $Root
Start-Sleep -Seconds 4

$backendStatus = Test-Http -Url "http://127.0.0.1:$BackendPort/health"
$uiStatus = Test-Http -Url "http://127.0.0.1:$UiPort/"

Write-Host "Backend health: $backendStatus"
Write-Host "UI health: $uiStatus"

node scripts/ops-health.mjs
