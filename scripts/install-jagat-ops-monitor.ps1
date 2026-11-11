param(
  [string]$TaskName = "JAGAT Ops Health Watchdog",
  [string]$ProjectRoot = "C:\JAGAT",
  [int]$IntervalMinutes = 15
)

$ErrorActionPreference = "Stop"
if ($IntervalMinutes -lt 5) { throw "IntervalMinutes must be at least 5." }
$script = Join-Path $ProjectRoot "scripts\jagat-ops-monitor.mjs"
if (-not (Test-Path -LiteralPath $script)) { throw "Monitor script not found: $script" }
$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`" --telegram" -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Reports local JAGAT health transitions to founder Telegram; no remote command handling." -Force | Out-Null
Write-Host "SCHEDULE=PASS"
Write-Host "TASK=$TaskName"
Write-Host "INTERVAL_MINUTES=$IntervalMinutes"
