# JAGAT Runtime Runbook

Tujuan runbook ini adalah menutup risiko R-006: service mati setelah restart server.

## Port Resmi

| Service | Port | Fungsi |
| --- | ---: | --- |
| Express BFF | 5000 | Backend JAGAT, Colony API, RAG orchestration |
| Next.js UI | 50012 | Founder/public UI |
| Redis | 6379 | Queue, session state, audit, colony state |
| Qdrant | 6333/6334 | Vector memory |
| Ollama | 11434 | Local inference/embedding |

## Start / Restart Stack

Dari PowerShell di `C:\JAGAT`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-jagat-stack.ps1 -Restart
```

Tanpa `-Restart`, script hanya menyalakan service yang belum listening:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-jagat-stack.ps1
```

## Health Check

```powershell
node scripts/ops-health.mjs
```

Expected:

- Express BFF: `200` with `status: operational` or `status: ok`; `503` is degraded and fails the health check
- Next.js UI: `200`
- Colony API Auth Gate: `401` tanpa credential
- Qdrant Vector DB: `200` from `/collections`
- Overall result: `PASS (4/4)`

Auth gate `401` adalah status sehat karena backend tidak boleh terbuka langsung tanpa secret/proxy identity.

## Telegram Ops Watchdog

Watchdog lokal memeriksa health BFF/UI/auth/Qdrant, membaca status dependency Redis/Qdrant/Ollama dari payload health BFF, dan memeriksa PM2 `jagat-telegram-bots`. Ia mengirim ringkasan ke Telegram founder saat fingerprint status berubah dan setiap enam jam. Jadwal aktif berjalan tiap 15 menit; retry notifikasi yang gagal ditahan selama 30 menit. Watchdog hanya mengirim status dan tidak menerima atau menjalankan perintah Telegram.

Status lokal tersimpan di `%LOCALAPPDATA%\JAGAT\ops-monitor\state.json`. Untuk memasang ulang jadwal:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-jagat-ops-monitor.ps1
```

Untuk melepas jadwal tanpa menghapus log atau state:

```powershell
Unregister-ScheduledTask -TaskName "JAGAT Ops Health Watchdog" -Confirm:$false
```

## C6 Scheduler / Reporter

Scheduler C6 otomatis start saat Express BFF boot, kecuali environment `C6_SCHEDULER_ENABLED=false`.

Verifikasi manual:

```powershell
node scripts/c6-scheduler-reporter-test.mjs
```

Endpoint founder-only:

```text
GET  /colony/scheduler/status
POST /colony/scheduler/tick
POST /colony/reporter/run
GET  /colony/reporter/summary?cadence=daily
```

Catatan penting: scheduler hanya mengambil task ringan yang benar-benar lolos policy. Task yang mengandung kata sensitif seperti `patch`, `write`, `scheduler`, `token`, `secret`, `deploy`, atau task phase C6 akan tetap founder-gated.

## Memory Library

UI founder memory tersedia di:

```text
http://127.0.0.1:50012/memory
```

API internal:

```text
GET /api/memory/library
```

Route `/memory` dan `/api/memory/library` memerlukan session valid. Tanpa session akan diarahkan ke `/login`.

## Log Runtime

Script start menulis log ke:

```text
ops/runtime-logs/backend-5000.out.log
ops/runtime-logs/backend-5000.err.log
ops/runtime-logs/ui-50012.out.log
ops/runtime-logs/ui-50012.err.log
```

## Recovery Cepat

1. Jalankan `node scripts/ops-health.mjs`.
2. Jika backend/UI gagal, jalankan `scripts/start-jagat-stack.ps1 -Restart`.
3. Jika Redis/Qdrant/Ollama mati, hidupkan service terkait terlebih dahulu, lalu ulangi health check.
4. Jika Next.js gagal karena build/cache, jalankan:

```powershell
cd C:\JAGAT\jagat-ui
npm run build
cd C:\JAGAT
powershell -ExecutionPolicy Bypass -File .\scripts\start-jagat-stack.ps1 -Restart
```

## Catatan Operasional

- Telegram/OpenClaw bukan sumber health utama.
- Health utama adalah backend, UI, auth gate, Redis, Qdrant, dan Ollama.
- Colony boleh dianggap usable hanya jika founder flow dan auth gate tetap lulus.
