$ErrorActionPreference = "Continue"

Set-Location -LiteralPath "C:\JAGAT"

Write-Host "JAGAT_REVENUE_CYCLE=START"
node .\scripts\prospect-discovery-agent-v1.mjs --max=8 --max-scan=72
$discoveryExit = $LASTEXITCODE

node .\scripts\autonomous-revenue-agent-v1.mjs --send-telegram
$briefExit = $LASTEXITCODE

node .\scripts\email-outreach-draft-agent-v1.mjs --send-telegram
$emailDraftExit = $LASTEXITCODE

if ($discoveryExit -ne 0 -or $briefExit -ne 0 -or $emailDraftExit -ne 0) {
  Write-Host "OUTREACH_DISPATCH=SKIPPED_PIPELINE_FAILURE"
  exit 1
}

node .\scripts\process-approved-outreach.mjs
$outreachExit = $LASTEXITCODE
if ($outreachExit -ne 0) {
  Write-Host "OUTREACH_EXIT=$outreachExit"
  exit $outreachExit
}

Write-Host "JAGAT_REVENUE_CYCLE=PASS"
