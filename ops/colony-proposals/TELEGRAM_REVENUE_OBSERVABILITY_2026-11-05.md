# Proposal: Telegram Revenue Workflow Observability

Date: 2026-11-05
Status: requires founder review before changing Telegram status behavior

## Evidence from current workspace

- Founder-only `status revenue` / `status prospek` / `status outreach` fast-path reads tracker, draft count, raw approval-file count, sent count, and mtimes for discovery/drafts/brief.
- It does not report the last revenue-cycle start/result, last Telegram event status/time, failed or unknown email attempts, or freshness age against a threshold.
- Telegram event ledger records `REVENUE_BRIEF` and `EMAIL_DRAFT_BATCH` with `DELIVERED` and UTC `sent_at`; local artifact mtimes are shown in local time. These are different signals and should be presented separately.
- The current owner-only bot source contains a separate model-output-to-shell execution path without an allowlist. AGENTS requires critical security findings to be escalated and not modified in this autonomous task. Runtime reload is also not authorized here.

## Proposed read-only status contract

Status response should include:
1. Latest artifact age for discovery, brief, draft JSON, and approval inbox, with explicit `FRESH` / `STALE` / `MISSING` classification from a documented threshold.
2. Latest `REVENUE_BRIEF` and `EMAIL_DRAFT_BATCH` event status/time from the Telegram event ledger; malformed/missing ledger must report `UNKNOWN`, never infer delivery from file mtime.
3. Outreach ledger totals grouped by `attempted`, `sent`, `failed`, `unknown`, plus newest event time. Do not expose recipient addresses, raw refusal text, or credentials in the summary.
4. Approval count labeled `pending files` rather than `valid approvals`, unless each record is fully checked against current draft, expiry, and signature/authentication. Current JSON name/UUID fields are not founder identity proof.
5. Scheduled task `LastRunTime`, result, and `NextRunTime` only if the status process can read it safely; otherwise show `not available` without executing the task.

## Acceptance criteria

- Pure formatter/parser tests cover delivered, failed, stale, missing, malformed JSONL, UTC/local rendering, and empty ledger.
- Founder fast-path remains read-only and checks owner identity before reading private revenue artifacts.
- Response stays bounded, omits PII/raw response/secret material, and does not call Telegram send APIs itself.
- Stale artifact and failed/unknown outcomes are visible without implying the overall cycle succeeded.
- No approval status is described as authenticated until a separate reviewed security design is implemented.
- Tests use temporary fixtures; no live Telegram, SMTP, Task Scheduler trigger, or production tracker mutation.

## Constraints and dependencies

- No eligible low-risk `Auto-Propose` backlog row exists currently: T-045 Ready is a migration/high-risk item; P-014 remains Candidate.
- D-043 continues to require founder-reviewed manual early revenue and forbids bulk auto-send.
- Security hardening of model-to-shell Telegram execution must be reviewed separately before relying on Telegram as an autonomous operations surface.
- Do not reload the running PM2 bot until security review and an authorized maintenance window. No production task is included in this proposal.

## Read-only snapshot implementation (2026-11-05)
Added `scripts/revenue-status-snapshot.mjs` with `npm run ops:revenue-status` and isolated tests via `npm run test:revenue-status`. It reads only local artifacts, distinguishes file freshness from Telegram delivery events, classifies malformed/future values conservatively, supports the legacy UTF-8-BOM single-object send ledger without editing it, counts sender outcomes including other states such as `blocked`, and omits recipient/response fields. It does not call Telegram, SMTP, Task Scheduler, or mutate tracker/approval files. Twelve offline assertions pass.

Current read-only snapshot: artifacts FRESH (~47 min); latest brief and draft notification events DELIVERED at 2026-11-05T21:49Z; send ledger OK with attempted=0, sent=57, failed=6, unknown=0, blocked=2; newest send event 2026-08-14T15:44Z. The current bot fast-path does not expose this helper yet; exposing it in Telegram remains a separate founder/security review and service maintenance action.

## Status classification refinement
The snapshot exposes `overall` for freshness + current brief/draft Telegram events, and a separate `outreach.health` (`OK`, `ATTENTION`, `UNKNOWN`) for sender-ledger integrity/outcomes. Historical failed sends do not mark a currently fresh/report-delivered cycle degraded; they remain visible as attention with counts and newest event timestamp. The read-only CLI does not trigger any workflow.

Latest local snapshot: `overall=HEALTHY`; four artifacts FRESH (~49 minutes); brief and draft-batch Telegram events DELIVERED at 2026-11-05T21:49Z. Outreach ledger is parseable but `health=ATTENTION`: sent=57, failed=6, blocked=2, attempted=0, unknown=0; newest event 2026-08-14T15:44Z. No current approval exists. Offline suite: 16 assertions PASS.

## Scheduled-cycle visibility
The read-only snapshot now queries Windows Task Scheduler metadata via a fixed PowerShell command and reports state, last run, result code, and next run. Query failure or non-Windows environments return `UNAVAILABLE`; the command never starts or changes the scheduled task. Offline tests cover normalized and unavailable results.

Latest verification: `npm run test:revenue-status` 18 assertions PASS. Local snapshot reports task `Ready`, last result 0 at 2026-11-05T13:41:40-08:00, next run 2026-11-05T16:41:39-08:00. No trigger was issued.

## Scheduler-result normalization edge case
The status mapper now preserves missing/empty/invalid `LastTaskResult` as null instead of coercing null to numeric zero (which could falsely imply success). Regression cases cover null and invalid values. Current suite: 20 assertions PASS; real scheduler result remains 0.

## Overall health now includes scheduler state
`overall=HEALTHY` now requires fresh artifacts, delivered brief and draft notifications, an available scheduler query, task state `Ready` or `Running`, and last result code 0. Disabled/unavailable tasks and nonzero results produce `DEGRADED`. Outreach history remains a separate `ATTENTION` signal. Regression suite: 22 assertions PASS. Current actual snapshot remains HEALTHY with task Ready/result 0/next 16:41:39.

## Existing scheduled Telegram notification integration (2026-11-05)
The existing `EMAIL_DRAFT_BATCH` notification now appends the read-only snapshot: overall status, scheduler state/last result/next run, artifact freshness, last brief/draft notification statuses, and sanitized email outcome counts/latest timestamp. It does not include recipient addresses or raw response content, does not add another Telegram send, and does not alter email approvals. Syntax and snapshot tests pass; no direct Telegram test was sent. Verify the added section through the natural scheduled run before claiming delivery integration is runtime-proven.

## Missed-cycle detection (2026-11-05 15:02 -08:00)
overall now degrades when the scheduler's next run is more than five minutes late, or when the last successful run is older than the configured three-hour interval plus five-minute grace. The task trigger was inspected read-only and confirms PT3H. Regression suite: 23 assertions PASS. Current task remains Ready with last result 0 and next run 16:41:39 local; the upcoming run and Telegram summary are not yet runtime-verified.


### Runtime probes in scheduled Telegram summary (2026-11-05 15:07 -08:00)
The existing scheduled EMAIL_DRAFT_BATCH notification now queries only loopback BFF health, UI, and Qdrant endpoints (1.5-second timeout) and prints dependency/service states. Probe failures are rendered as offline/unreachable. No credentials or prospect data are included. Syntax and 23 snapshot checks pass. Current read-only probes: BFF HTTP 503 (Ollama/Redis connected, Qdrant unreachable), UI 200, Qdrant unreachable. Message content awaits natural scheduled delivery; no manual Telegram send was used.


### Health-aware event deduplication (2026-11-05 15:09 -08:00)
The EMAIL_DRAFT_BATCH dedupe fingerprint now incorporates pipeline state, scheduler state/result, and sanitized local runtime summary. Repeated identical draft+health states stay deduped; a runtime health change creates a fresh event key. Offline fingerprint check confirms different health states hash differently; current key is not already delivered. No direct Telegram send; await natural scheduled cycle.


### Persist delivery evidence (2026-11-05 15:12 -08:00)
After a successful existing EMAIL_DRAFT_BATCH send, its local ledger summary now records pipeline, scheduler, and sanitized runtime state. This enables verification of the next natural cycle without storing recipients or draft bodies. Syntax and 23 snapshot checks pass; no direct message sent.
