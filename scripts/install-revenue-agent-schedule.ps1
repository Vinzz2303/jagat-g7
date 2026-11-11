param(
  [string]$TaskName = "JAGAT Autonomous Revenue Agent V1",
  [string]$ProjectRoot = "C:\JAGAT",
  [string]$IntervalHours = "6"
)

$ErrorActionPreference = "Stop"

$powershell = (Get-Command powershell).Source
$script = Join-Path $ProjectRoot "scripts\run-autonomous-revenue-cycle-v1.ps1"

if (-not (Test-Path -LiteralPath $script)) {
  throw "Revenue agent script not found: $script"
}

$action = New-ScheduledTaskAction `
  -Execute $powershell `
  -Argument "-ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $ProjectRoot

$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(3) `
  -RepetitionInterval (New-TimeSpan -Hours ([int]$IntervalHours)) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Runs JAGAT prospect discovery, then sends founder-reviewed revenue brief to Telegram." `
  -Force | Out-Null

Write-Host "SCHEDULE=PASS"
Write-Host "TASK=$TaskName"
Write-Host "INTERVAL_HOURS=$IntervalHours"
