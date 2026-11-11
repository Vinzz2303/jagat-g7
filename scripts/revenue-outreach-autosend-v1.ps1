param(
  [int]$DailyLimit = 10,
  [switch]$Approved
)

$ErrorActionPreference = "Stop"

Write-Host "OUTREACH_AUTOSEND=BLOCKED"
Write-Host "REASON=legacy bulk sender disabled by D-043; use per-draft approval sender"
exit 2

$Root = "C:\JAGAT"
$RevenueDir = Join-Path $Root "ops\revenue"
$TrackerPath = Join-Path $RevenueDir "PROSPECT_TRACKER.csv"
$LedgerPath = Join-Path $RevenueDir "outreach-send-ledger.jsonl"

function Get-EnvFirst([string[]]$Names) {
  foreach ($name in $Names) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "User") }
    if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "Machine") }
    if ($value) { return $value }
  }
  return ""
}

function Write-Ledger([hashtable]$Event) {
  $Event.ts = (Get-Date).ToUniversalTime().ToString("o")
  $line = ($Event | ConvertTo-Json -Compress)
  Add-Content -LiteralPath $LedgerPath -Value $line -Encoding UTF8
}

function Test-StopSignal([string]$Text) {
  return $Text -match "(?i)\b(stop|unsubscribe|tolak|jangan|tidak tertarik|not interested|remove)\b"
}

function Get-SentKeys {
  $keys = @{}
  if (-not (Test-Path -LiteralPath $LedgerPath)) { return $keys }
  Get-Content -LiteralPath $LedgerPath | ForEach-Object {
    try {
      $event = $_ | ConvertFrom-Json
      if ($event.status -eq "sent" -and $event.key) { $keys[$event.key] = $true }
    } catch {}
  }
  return $keys
}

function New-Subject($Lead) {
  $offerText = [string]$Lead.offer
  if ($offerText -match "(?i)website") {
    return "Ide website + AI admin ringan untuk $($Lead.company_or_person)"
  }
  return "Ide AI admin ringan untuk $($Lead.company_or_person)"
}

function New-Body($Lead, [string]$FromName) {
  $name = if ($Lead.company_or_person) { $Lead.company_or_person } else { "bisnis Kakak" }
  $offer = if ($Lead.offer) { $Lead.offer } else { "AI Admin Bot" }
  $problem = if ($Lead.problem_hypothesis) { $Lead.problem_hypothesis.TrimEnd(".") } else { "pekerjaan admin dan pertanyaan pelanggan masih bisa dibuat lebih rapi" }
  $message = if ($Lead.recommended_message) { $Lead.recommended_message } else { "Saya bisa kirim demo ringan agar Kakak bisa lihat gambaran manfaatnya." }
  return @"
Halo Kak,

Saya Faturachman dari JAGAT AI. Saya melihat $name punya peluang untuk dibantu dengan $offer.

Dari yang saya lihat, kebutuhan awalnya kemungkinan: $problem.

$message

Kalau cocok, saya bisa kirim contoh demo singkat dulu. Tidak perlu komitmen apa-apa di awal.

Salam,
$FromName
JAGAT AI
"@
}

if (-not $Approved) {
  Write-Ledger @{ status = "blocked"; reason = "missing_approved_flag"; sent = 0 }
  Write-Host "OUTREACH_AUTOSEND=BLOCKED"
  Write-Host "REASON=missing_approved_flag"
  exit 2
}

$smtpHost = Get-EnvFirst @("REVENUE_SMTP_HOST")
$smtpPort = [int](Get-EnvFirst @("REVENUE_SMTP_PORT"))
if (-not $smtpPort) { $smtpPort = 587 }
$smtpUser = Get-EnvFirst @("REVENUE_SMTP_USER", "JAGAT_OUTREACH_EMAIL")
$smtpPass = Get-EnvFirst @("REVENUE_SMTP_PASS", "JAGAT_OUTREACH_APP_PASSWORD")
$from = Get-EnvFirst @("REVENUE_EMAIL_FROM", "JAGAT_OUTREACH_EMAIL", "REVENUE_SMTP_USER")
$fromName = Get-EnvFirst @("REVENUE_EMAIL_FROM_NAME")
if (-not $fromName) { $fromName = "Faturachman Al Kahfi" }

if (-not $smtpHost -or -not $smtpUser -or -not $smtpPass -or -not $from) {
  Write-Ledger @{ status = "blocked"; reason = "missing_smtp_env"; sent = 0 }
  Write-Host "OUTREACH_AUTOSEND=BLOCKED"
  Write-Host "REASON=missing_smtp_env"
  exit 0
}

$today = (Get-Date).ToString("yyyy-MM-dd")
$alreadySent = 0
if (Test-Path -LiteralPath $LedgerPath) {
  $alreadySent = @(Get-Content -LiteralPath $LedgerPath | ForEach-Object {
    try {
      $event = $_ | ConvertFrom-Json
      $eventTs = [string]$event.ts
      if ($event.status -eq "sent" -and $eventTs.StartsWith($today)) { $event }
    } catch {}
  }).Count
}

$remaining = [Math]::Max(0, $DailyLimit - $alreadySent)
if ($remaining -le 0) {
  Write-Ledger @{ status = "skipped"; reason = "daily_limit_reached"; sent = 0; dailyLimit = $DailyLimit }
  Write-Host "OUTREACH_AUTOSEND=PASS"
  Write-Host "SENT=0"
  Write-Host "REASON=daily_limit_reached"
  exit 0
}

$sentKeys = Get-SentKeys
$leads = Import-Csv -LiteralPath $TrackerPath | Where-Object {
  $_.public_contact -match "@" -and
  -not (Test-StopSignal "$($_.response) $($_.notes)") -and
  -not $sentKeys.ContainsKey(("{0}|{1}" -f ([string]$_.public_contact).ToLowerInvariant(), ([string]$_.company_or_person).ToLowerInvariant()))
} | Select-Object -First $remaining

$secure = ConvertTo-SecureString $smtpPass -AsPlainText -Force
$credential = [pscredential]::new($smtpUser, $secure)
$sent = 0

foreach ($lead in $leads) {
  $key = "{0}|{1}" -f $lead.public_contact.ToLowerInvariant(), $lead.company_or_person.ToLowerInvariant()
  $subject = New-Subject $lead
  $body = New-Body $lead $fromName
  try {
    Send-MailMessage -SmtpServer $smtpHost -Port $smtpPort -UseSsl -Credential $credential -From $from -To $lead.public_contact -Subject $subject -Body $body -Encoding UTF8
    $sent += 1
    Write-Ledger @{ status = "sent"; key = $key; to = $lead.public_contact; company = $lead.company_or_person; subject = $subject; source = $lead.source }
  } catch {
    Write-Ledger @{ status = "failed"; key = $key; to = $lead.public_contact; company = $lead.company_or_person; error = $_.Exception.Message }
  }
}

Write-Host "OUTREACH_AUTOSEND=PASS"
Write-Host "SENT=$sent"
Write-Host "LEDGER=$LedgerPath"
