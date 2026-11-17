# JAGAT G7 — Phase 1.1 Implementation & Remediation Plan (Revised)
**Document Version:** 1.1.0 (Architecture Review Revision)  
**Status:** DRAFT PROPOSAL — AWAITING FOUNDER APPROVAL  
**Mode:** PLAN FIRST — NO CODE CHANGES  

---

## 1. Rencana Implementasi Terperinci (Minimal Patch & Reversible)

Perbaikan dirancang dalam 6 Work Packages bertahap tanpa membongkar core engine:

### Work Package A: Event-Driven Telegram Deduplication (Fix Bot Spamming)
* **Tujuan:** Menghentikan loop notifikasi statis 3 jam sekali di Telegram Mas Fatur.
* **Tindakan:**
  1. Buat notification ledger: `C:\JAGAT\ops\revenue\telegram-events.jsonl`.
  2. Modifikasi `autonomous-revenue-agent-v1.mjs` dan `email-outreach-draft-agent-v1.mjs`: tambahkan pengecekan event ID `{lead_id}:{campaign_id}`. Jika sudah pernah terkirim ke Telegram, jangan kirim ulang (*skip*).
  3. Siapkan template pesan interaktif dengan tombol inline callback `[✅ Approve & Send]` dan `[❌ Reject & Suppress]`.
  4. Nonaktifkan scheduler broadcast lama `\JAGAT Autonomous Revenue Agent V1` **hanya setelah** mekanisme baru teruji.
* **File Target:**
  - `C:\JAGAT\scripts\autonomous-revenue-agent-v1.mjs`
  - `C:\JAGAT\scripts\email-outreach-draft-agent-v1.mjs`
  - `C:\JAGAT\src\colony\telegram-bot.ts`

---

### Work Package B: Pemisahan Approval State & Delivery State (Fix Zombie Pending)
* **Tujuan:** Menjadikan `approval_status` dan `delivery_status` dua field terpisah.
* **Tindakan:**
  1. Pada `types.ts` dan `engine.ts`:
     - Tambahkan `approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'`.
     - Tambahkan `delivery_status: 'NOT_SENT' | 'RESERVED' | 'SENT' | 'FAILED' | 'NEEDS_RECONCILIATION'`.
  2. Fungsi `executeOutboundSend()` **hanya** memperbarui `delivery_status`, dan **TIDAK MENGUBAH** `approval_status` secara otomatis.
  3. Perbarui `TelegramApprovalView.tsx` agar menyaring draf berdasarkan `approval_status === 'PENDING'`, dan menampilkan status delivery secara terpisah.
* **File Target:**
  - `c:\apps\jagat-phase-1-console\src\phase1\types.ts`
  - `c:\apps\jagat-phase-1-console\src\phase1\engine.ts`
  - `c:\apps\jagat-phase-1-console\src\components\TelegramApprovalView.tsx`

---

### Work Package C: Coordinated Serialized Writer & Core Persistence Adapter
* **Tujuan:** Menghubungkan Console ke data aktual Core secara persisten dan aman dari tabrakan tulis (*concurrent writes*).
* **Tindakan:**
  1. Buat module `src/phase1/core-adapter.ts` dengan antrean serial (*Promise FIFO queue*) untuk penulisan atomic file ke `outreach-send-ledger.jsonl`, `approval-ledger.jsonl`, dan `PROSPECT_TRACKER.csv`.
  2. Setiap event diberi `event_id` unik deterministik (`evt-${Date.now()}-${randomHex}`).
  3. Backup otomatis dibuat di `C:\JAGAT\ops\backups\` sebelum operasi penulisan batch.
  4. Saat Console start, baca langsung 101 leads dari `PROSPECT_TRACKER.csv` dan riwayat pengiriman dari `outreach-send-ledger.jsonl`.
* **File Target:**
  - `c:\apps\jagat-phase-1-console\src\phase1\core-adapter.ts` (NEW)
  - `c:\apps\jagat-phase-1-console\server.ts`
  - `c:\apps\jagat-phase-1-console\src\phase1\engine.ts`

---

### Work Package D: Provenance Badges pada Metrik Dashboard
* **Tujuan:** Memperjelas asal-usul setiap angka di UI konsol.
* **Tindakan:**
  Perbarui kartu metrik di `LeadPipelineView.tsx`, `TelegramApprovalView.tsx`, dan `ModelRouterInfraView.tsx` untuk menampilkan badge:
  - `ACTUAL`: Total Leads (101), Outbound Sent (Lifetime), Sent Today (24h).
  - `ESTIMATED`: API Cost (IDR).
  - `SIMULATED`: Test Sandbox Run.
* **File Target:**
  - `c:\apps\jagat-phase-1-console\src\components\LeadPipelineView.tsx`
  - `c:\apps\jagat-phase-1-console\src\components\TelegramApprovalView.tsx`

---

### Work Package E: 5-Way Inbound Closer Classification
* **Tujuan:** Mencegah over-suppression pada balasan penundaan waktu.
* **Tindakan:**
  Perbarui fungsi `processInboundReply()` di `engine.ts`:
  - `UNSUBSCRIBE_OPT_OUT` $\rightarrow$ status `UNSUBSCRIBED` + blacklist permanen di `suppressedEmails`.
  - `NOT_NOW_OBJECTION` $\rightarrow$ status `OBJECTION_HOLD` (TIDAK di-blacklist, follow-up nanti).
  - `NEGATIVE_GENERAL` $\rightarrow$ status `CLOSED_LOST` (TIDAK di-blacklist).
  - `POSITIVE_INTEREST` $\rightarrow$ status `POSITIVE` (Kirim Calendly).
  - `NEEDS_HUMAN_REVIEW` $\rightarrow$ status `NEEDS_HUMAN_REVIEW` (Eskalasi manusia).
* **File Target:**
  - `c:\apps\jagat-phase-1-console\src\phase1\engine.ts`
  - `c:\JAGAT\src\colony\closer-agent.ts`

---

### Work Package F: Eksekusi 10 Skema Uji Integrasi Otomatis
* **Tujuan:** Menjalankan `npx tsx src/phase1/integration-phase1-1.test.ts` untuk memverifikasi T-01 s.d. T-10.
* **File Target:**
  - `c:\apps\jagat-phase-1-console\src\phase1\integration-phase1-1.test.ts` (NEW)

---

## 2. Kriteria Penerimaan Akhir (Final Acceptance Conditions)

Fase 1.1 dinyatakan selesai secara resmi hanya jika seluruh 8 syarat terpenuhi:

1. **Konsistensi Core & Console:** Data yang ditampilkan di Console (Port 5005) mencerminkan data aktual di file Core `PROSPECT_TRACKER.csv` dan `outreach-send-ledger.jsonl`.
2. **Resiliensi Reboot:** Server di-restart, status approval yang sudah selesai (`APPROVED` / `REJECTED`) tidak pernah kembali menjadi `PENDING`.
3. **Zero Duplicate Outbound:** Uji coba kirim ulang ke prospek yang sama ditolak oleh Idempotency Guard.
4. **Pemisahan Lifecycle:** Status `approval_status` dan `delivery_status` terbukti independen.
5. **Eliminasi Telegram Spam:** Bot Telegram tidak lagi mengirim notifikasi berulang untuk prospek yang sama.
6. **10/10 Integration Tests Pass:** Pengujian otomatis T-01 s.d. T-10 lulus tanpa mock palsu.
7. **Rollback Teruji:** Mematikan feature flag mengembalikan alur ke fallback legacy secara bersih.
8. **Zero Core Regression:** Service Core di Port 5000 dan Next.js Port 50012 tetap berjalan sehat tanpa gangguan.
