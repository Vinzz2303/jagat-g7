# JAGAT G7 Error & SMTP Diagnostic Bundle (2026-11-11)

## 1. Ringkasan Penyebab Error Pengiriman Email SMTP
1. **Error Koneksi Historis (`outreach-send-ledger.jsonl`)**:
   - **6x `failed` (2026-08-13):** `connect ETIMEDOUT 74.125.24.109:465`, `172.217.194.109:465`, `74.125.200.109:465` (TCP outbound ke SMTP Gmail port 465 timeout pada saat itu).
   - **2x `blocked` (2026-07-07):** `missing_smtp_env` (environment variables SMTP belum terbaca).
2. **Status SMTP Live Saat Ini (2026-11-11):**
   - `initEmailAdapter()` berhasil (`SMTP_OK=true`), DNS `smtp.gmail.com` resolve ke `172.253.118.108`.
   - 2 pengiriman terakhir sukses di bawah kebijakan D-052 (`founder_campaign_policy`): `admin@vessacatering.co.id` (2026-11-07) dan `marketing@kindaracatering.com` (2026-11-08).
3. **Kenapa Tidak Ada Email Terkirim Setelah 2026-11-08 (Walaupun SMTP Sehat)?**
   - Seluruh 5 draft di `OUTREACH_DRAFTS.json` ditolak oleh aturan campaign D-052 (`AUTO_SEND_POLICY.json`) dengan exit code `2`:
     `AUTO_OUTREACH_SKIPPED=recipient must be a role mailbox on the official website domain`
   - Lihat detail hasil `--preview` di `01_smtp-and-outreach/smtp-live-check-output.txt`.

## 2. Error Pipeline Terjadwal & AI Providers (2026-11-11)
- **Scheduled Task `JAGAT Autonomous Revenue Agent V1`:** `LastTaskResult: 1` (16:41:40 PST), `overall: DEGRADED`.
- **Gemini API 402:** `Your prepayment credits are depleted ... RESOURCE_EXHAUSTED` (04:49 PST).
- **Network `fetch failed`:** 07:44, 10:44, 13:45, 16:45 PST — brief fallback lokal & pengiriman Telegram gagal sehingga `run-autonomous-revenue-cycle-v1.ps1` keluar dengan `OUTREACH_DISPATCH=SKIPPED_PIPELINE_FAILURE`.
- **Groq Model Decommissioned (`jagat-telegram-bots-error.log`):** `Groq API Error: 400 - The model llama3-8b-8192 has been decommissioned`.
- **Remote Ollama Unreachable:** `[JAGAT:OLLAMA] Remote /api/generate failed; falling back to local: fetch failed`.
- **PM2 Swarm Legacy Error:** `C:\PROGRAM FILES\NODEJS\NPM.CMD:1 SyntaxError: Unexpected token ':'`.
- **Cloud Postgres Unreachable (UI):** `(ENOTFOUND) tenant/user postgres.<redacted-supabase-ref> not found` (fallback ke memory lokal).

## 3. Struktur Folder di Dalam ZIP Ini
- `01_smtp-and-outreach/`: Send ledger, revenue status snapshot, live SMTP check & preview output, drafts, briefs, Telegram event ledger.
- `02_pm2-logs/`: Seluruh log PM2 (`jagat-telegram-bots`, `jagat-autonomous-swarm`, `jagat-ui`).
- `03_runtime-and-server-logs/`: Log BFF port 5000, UI port 50012, dan Qdrant 6333.
- `04_relevant-smtp-scripts/`: Kode `email-adapter.ts`, `revenue-outreach-email.mjs`, `process-approved-outreach.mjs`, `run-autonomous-revenue-cycle-v1.ps1`.
