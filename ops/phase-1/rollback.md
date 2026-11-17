# JAGAT Phase 1 — Rollback & Emergency Recovery Procedure

## 1. Filosofi Rollback Tanpa Downtime
Seluruh komponen baru pada **JAGAT Phase 1** diimplementasikan sebagai lapisan modular di balik **Feature Flags** dan **Global Controls**. Tidak ada tabel atau file lama (`PROSPECT_TRACKER.csv`, `outreach-send-ledger.jsonl`) yang dihapus atau diubah formatnya secara destruktif.

---

## 2. Penghentian Darurat Outbound (Global Kill / Pause Switch)
Jika ditemukan anomali pada pengiriman email atau balasan otomatis:
1. **Melalui Dashboard / Telegram:** Aktifkan tombol **Global Pause Outbound** (`globalPause = true`) pada tab *Telegram Approval & Policy*.
2. **Melalui Environment Variable:** Setel `JAGAT_GLOBAL_PAUSE=true` dan `JAGAT_OUTBOUND_MODE=PREPARE`.
3. **Efek Instan:** Seluruh pengiriman SMTP baru dan balasan otomatis `closer-agent` langsung tertahan di tahap `DRAFTED` / `PENDING_APPROVAL` tanpa menghentikan proses pencarian prospek (Discovery) maupun pembacaan log.

---

## 3. Rollback Per Lapisan via Feature Flags

Setiap lapisan Phase 1 dapat dinonaktifkan secara independen melalui panel **Feature Flags & Rollback** di UI atau variabel environment:

| Feature Flag | Fungsi Saat Aktif (`true`) | Perilaku Saat Rollback (`false`) |
| :--- | :--- | :--- |
| `FF_OUTREACH_POLICY_ENGINE` | Menjalankan validasi relevansi, suppression, rate limit, dan gate approval sebelum kirim. | Kembali ke pengecekan kuota harian standar (`MAX_EMAILS_PER_DAY`). |
| `FF_IDEMPOTENCY_GUARD` | Memeriksa kunci atomik `outreach:{lead_id}:{campaign_id}:{message_type}` dan status `NEEDS_RECONCILIATION`. | Hanya memeriksa log pengiriman harian di `outreach-send-ledger.jsonl`. |
| `FF_LEAD_STATE_MACHINE` | Mencatat 15 status daur hidup prospek beserta histori `outreach_events`. | Menggunakan kolom `status` sederhana (`new`, `email_found`, `emailed`). |
| `FF_INBOUND_SAFETY_GUARD` | Sanitasi prompt injection, pencocokan `lead_id`, dan ambang batas `confidence >= 0.80`. | Klasifikasi intent dasar `POSITIVE` / `NEGATIVE` / `OTHER`. |
| `FF_MODEL_COST_ROUTER` | Routing berbasis task dengan circuit breaker, pencatatan biaya IDR, dan hard budget cap. | Menggunakan rute default `HybridRouter`. |
| `FF_RAG_HEALTH_GUARD` | Validasi dimensi 768 koleksi `jagat_indonesia_knowledge` sebelum query RAG. | Bypass validasi pra-query dan gunakan *graceful degradation*. |

---

## 4. Pemulihan State Rekonsiliasi (`NEEDS_RECONCILIATION`)
Apabila terdapat prospek yang berstatus `NEEDS_RECONCILIATION` akibat worker berhenti mendadak saat transaksi SMTP:
1. Buka tab **Telegram Approval & Policy** → bagian **Idempotency & Reconciliation Guard**.
2. Periksa apakah `provider_message_id` tercatat pada `outreach-send-ledger.jsonl` atau kotak terkirim (Sent Box) Gmail.
3. Klik **Mark Confirmed Sent** jika email terbukti sudah terkirim (status berubah menjadi `SENT` tanpa mengirim ulang), atau klik **Release Lock & Reset to Approved** jika email terbukti belum keluar dari SMTP.
