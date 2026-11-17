# JAGAT Phase 1 — File-by-File Change Plan

## Prinsip Perubahan
1. **Reuse First:** Tidak menulis ulang Express BFF, Colony Core, Swarm Pipeline, C6 Scheduler, Telegram Bot, SMTP/IMAP Sender, atau Closer Agent dari nol.
2. **Feature-Flagged Upgrade:** Seluruh perilaku baru dikendalikan oleh feature flags (`FF_*`) sehingga dapat di-rollback secara instan ke perilaku lama tanpa downtime.
3. **Zero Real Email on Dev/Test:** Selama pengembangan dan pengujian staging, pengiriman email menggunakan *Mock/Staging Transport* dan hanya mengizinkan domain allowlist staging.

---

## Rencana Perubahan Per File

| Urutan | File / Modul | Jenis Perubahan | Rincian Teknis & Alasan |
| :--- | :--- | :--- | :--- |
| **1** | `src/phase1/types.ts` | **Baru (Layer Types)** | Mendefinisikan tipe data Phase 1: 15 status `LeadStatus`, `LeadRecord`, `OutreachMessage`, `OutreachEvent`, `ApprovalItem`, `ModelUsageRecord`, `TaskType`, `FeatureFlags`, dan `RedisLockRecord`. |
| **2** | `src/phase1/lead-state-manager.ts` | **Baru (Layer State)** | Mengelola state machine prospek (`DISCOVERED` → `QUALIFIED` → `CONTACT_VERIFIED` → `DRAFTED` → `PENDING_APPROVAL` → `SENT` → `REPLIED` → `POSITIVE` → `MEETING` → `PROPOSAL` → `WON`/`LOST`, serta `BOUNCED`, `FAILED`, `DUPLICATE`, `SUPPRESSED`, `UNSUBSCRIBED`, `NEEDS_HUMAN_REVIEW`, `NEEDS_RECONCILIATION`) lengkap dengan histori `outreach_events` di setiap transisi dan sinkronisasi dengan data `PROSPECT_TRACKER.csv`. |
| **3** | `src/phase1/idempotency-guard.ts` | **Baru (Layer Idempotency)** | Menghasilkan kunci deterministik `outreach:{lead_id}:{campaign_id}:{message_type}`, menyimpan reservasi pengiriman secara atomik sebelum SMTP dipanggil, mencegah pengiriman ganda saat retry/restart, dan menangani *crash recovery* dengan status `NEEDS_RECONCILIATION`. |
| **4** | `src/phase1/outreach-policy-engine.ts` | **Baru (Layer Policy)** | Memvalidasi kelayakan prospek sebelum kirim: cek Global Pause Switch, Per-Campaign Pause, Suppression/Opt-out list, skor kualifikasi ($\ge 65$), format email valid, batas kuota harian/siklus, fakta grounding, serta menentukan mode eksekusi (`PREPARE`, `APPROVAL` [default prospek baru], `CONTROLLED_AUTO_SEND`). |
| **5** | `src/phase1/inbound-closer-guard.ts` | **Upgrade `closer-agent.ts`** | Memfilter *untrusted inbound email* dari serangan *prompt injection* (upaya membaca secret/mengubah system policy), mencocokkan balasan ke `lead_id` yang tepat, menerapkan *confidence threshold* ($\ge 0.80$) sebelum mengirim link Calendly, mengeskalasi balasan ambigu ke `NEEDS_HUMAN_REVIEW`, dan otomatis menekan (`UNSUBSCRIBED`/`SUPPRESSED`) balasan negatif. |
| **6** | `src/phase1/model-router-cost.ts` | **Upgrade `model-router.ts` & `hybrid-router.ts`** | Mengarahkan task (`classification`, `extraction_json`, `email_generation`, `complex_reasoning`, `coding`, `embedding`) ke model paling efisien (`llama3.2:1b`, `gemini-3.8-flash`, `gemini-4-argon`, `nomic-embed-text`), dilengkapi timeout, fallback order, circuit breaker, pencatatan `model_usage`, dan *Hard Budget Cap* Rp350.000–Rp500.000 dengan *auto-stop kill switch*. |
| **7** | `src/phase1/reliability-monitor.ts` | **Upgrade `scheduler-queue.ts` & `qdrant.ts`** | Menyediakan *atomic compare-and-delete* untuk Redis lock (dengan TTL & owner token), deteksi *stale lock* & *campaign concurrency cap*, serta validasi kesehatan Qdrant (`jagat_indonesia_knowledge` dimensi 768) dengan *graceful degradation*. |
| **8** | `server.ts` | **Integrasi BFF & Gemini API** | Menyediakan REST API Express BFF untuk seluruh operasi Phase 1, integrasi server-side `@google/genai` (`gemini-3.8-flash` & `gemini-4-argon`), dan penyajian dokumen audit `docs/phase-1/*.md`. |
| **9** | `src/phase1/phase1.test.ts` | **Unit & Integration Tests** | Menguji seluruh 10 Acceptance Criteria Phase 1 secara deterministik menggunakan `node:test`. |
