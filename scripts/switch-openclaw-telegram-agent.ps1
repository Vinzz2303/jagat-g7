$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("ingest", "builder")]
  [string]$Mode
)

$configPath = "C:\Users\Administrator\.openclaw\openclaw.json"
$gatewayCmdPattern = '*C:\Users\Administrator\openclaw\openclaw.mjs*gateway*run*--force*'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "OpenClaw config tidak ditemukan: $configPath"
}

$jsonText = [System.IO.File]::ReadAllText($configPath)
$config = $jsonText | ConvertFrom-Json -Depth 100

if (-not $config.bindings -or $config.bindings.Count -eq 0) {
  throw "Tidak ada bindings[] di config OpenClaw."
}

$binding = $config.bindings[0]
if (-not $binding) {
  throw "Binding Telegram utama tidak ditemukan."
}

switch ($Mode) {
  "ingest" {
    $binding.agentId = "telegram-ingest-mimo"
    $binding.comment = "Route Telegram DM Faturachman to MiMo ingest/planner first, then hand off clean work to builder-mimo."
  }
  "builder" {
    $binding.agentId = "builder-mimo"
    $binding.comment = "Route Telegram DM Faturachman directly to builder-mimo for source-code verification and coding execution."
  }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  $configPath,
  ($config | ConvertTo-Json -Depth 100),
  $utf8NoBom
)

Write-Host "Binding Telegram diubah ke agent: $($binding.agentId)"

$validate = & node C:\Users\Administrator\openclaw\openclaw.mjs config validate 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error ($validate -join [Environment]::NewLine)
  exit 1
}

Write-Host "Config valid. Restarting OpenClaw gateway..."

$processes = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "node.exe" -and $_.CommandLine -like $gatewayCmdPattern
}

foreach ($proc in $processes) {
  Stop-Process -Id $proc.ProcessId -Force
}

Start-Sleep -Seconds 2

$null = Start-Process -FilePath "node" `
  -ArgumentList "C:\Users\Administrator\openclaw\openclaw.mjs", "gateway", "run", "--force" `
  -WindowStyle Hidden

Start-Sleep -Seconds 6

$status = & node C:\Users\Administrator\openclaw\openclaw.mjs channels status 2>&1
Write-Host ($status -join [Environment]::NewLine)

Write-Host ""
Write-Host "Mode aktif sekarang: $Mode"
if ($Mode -eq "ingest") {
  Write-Host "Gunakan mode ini untuk baca dokumen, ringkas gap, dan buat handoff."
} else {
  Write-Host "Gunakan mode ini untuk audit source code aktual, verifikasi runtime, dan coding berat."
}
