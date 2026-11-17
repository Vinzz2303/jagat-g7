# JAGAT Phase 1 — Implementation & Decision Log

## Keputusan Arsitektur Utama (2026-10-30)

### 1. Strategi Penyimpanan Data (Tanpa Migrasi Paksa)
- **Temuan Audit:** Repositori `jagat-ai-codebase` saat ini menggunakan `ops/revenue/PROSPECT_TRACKER.csv` untuk daftar prospek, `ops/revenue/outreach-send-ledger.jsonl` untuk log pengiriman email, `data/usage_events.jsonl` untuk metrik penggunaan, dan Redis untuk antrean Colony.
- **Keputusan:** Sesuai Bagian 6 Blueprint Phase 1 (*"Jangan memaksakan migrasi database... JSONL ledger tetap dipertahankan sebagai audit trail selama transisi"*), kami membangun `LeadStateManager` yang mengimpor dan menyinkronkan data aktual dari `PROSPECT_TRACKER.csv` & `outreach-send-ledger.jsonl` ke dalam struktur entitas Phase 1 (`leads`, `outreach_messages`, `outreach_events`, `agent_tasks`, `model_usage`, `approvals`) tanpa merusak kompatibilitas script lama.

### 2. Idempotency & Reconciliation State
- **Keputusan:** Setiap upaya pengiriman outbound wajib melewati `IdempotencyGuard.reserveSend(leadId, campaignId, messageType)`.
- Kunci deterministik berformat `outreach:{lead_id}:{campaign_id}:{message_type}`.
- Jika worker mengalami kegagalan setelah SMTP menerima pesan namun sebelum status akhir tercatat, reservasi ditandai sebagai `NEEDS_RECONCILIATION`. Sistem memblokir pengiriman ulang otomatis pada status ini sampai rekonsiliasi selesai dilakukan melalui pemeriksaan `provider_message_id` / send ledger.

### 3. Kontrol Otonomi Outbound & Telegram Approval UX
- **Keputusan:** Mengubah perilaku default pengiriman dari *unrestricted blast* menjadi **Approval Mode (`APPROVAL`)** untuk seluruh prospek baru.
- Menyediakan tiga mode operasional:
  1. `PREPARE`: Discovery, kualifikasi, dan pembuatan draft berjalan otomatis; tidak ada email yang dikirim.
  2. `APPROVAL` (Default): Draft yang lulus pemeriksaan kebijakan masuk ke antrean `PENDING_APPROVAL` untuk ditinjau melalui antarmuka Telegram Approval (`Approve`, `Edit`, `Skip/Suppress`, `Pause Campaign`).
  3. `CONTROLLED_AUTO_SEND`: Hanya diizinkan untuk segmen dan template terverifikasi dengan kuota harian ketat (`MAX_EMAILS_PER_DAY = 10`, `MAX_PER_CYCLE = 2`), pemeriksaan suppression, dan audit trail penuh.

### 4. Keamanan Inbound Email & Confidence Threshold
- **Keputusan:** `InboundCloserGuard` membungkus isi email masuk dalam pembatas *untrusted input*, melakukan deteksi dan sanitasi pola *prompt injection* (seperti instruksi pengabaian sistem atau permintaan kredensial), mencocokkan alamat pengirim ke `leads`, serta memberlakukan ambang batas `confidence >= 0.80` sebelum mengizinkan balasan otomatis berisi tautan Calendly.

### 5. Model Router & Hard Budget Cap (Rp350.000–Rp500.000)
- **Keputusan:** Menyatukan logika routing ke dalam `ModelRouterAndCostTracker` yang memetakan 6 jenis task (`classification`, `extraction_json`, `email_generation`, `complex_reasoning`, `coding`, `embedding`) ke rute model optimal (`llama3.2:1b`, `gemini-3.8-flash`, `gemini-4-argon`, `nomic-embed-text`).
- Memasang *Hard Cap Global* sebesar **Rp500.000** (batas eksperimen API Rp350.000 + buffer operasional Rp150.000) dan batas peringatan harian. Ketika pengeluaran mencapai batas hard cap, *kill switch* otomatis menahan pemanggilan model cloud berbayar dan mengalihkan ke model lokal atau menghentikan eksekusi non-esensial.
