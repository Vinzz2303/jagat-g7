# JAGAT G7 — Phase 1 Production Readiness Checklist
**Evaluation Standard:** Blueprint Implementation Rules & Goals Document  
**Date:** 2026-10-30  

---

## 1. Safety & Policy Gates Checklist
- [x] **Rate Limit Cap Harian:** Terkunci maksimal 10 email per hari.
- [x] **Global Pause Switch:** Memutus antrean pengiriman secara instan saat toggle diaktifkan.
- [x] **Suppression Blacklist:** Prospek yang menyatakan *unsubscribe* otomatis diblokir dari seluruh kampanye.
- [x] **Idempotency Key:** Kunci unik `{lead_id}:{campaign_id}:{type}` mencegah duplikasi pengiriman.
- [x] **Pre-SMTP Atomic Reservation:** Status pesan dikunci menjadi `RESERVED` sebelum memanggil transport.
- [x] **Crash Recovery State:** Crash pasca-SMTP otomatis menetapkan status `NEEDS_RECONCILIATION`.
- [x] **Human Approval Gate:** Draf prospek baru wajib diverifikasi manusia sebelum transmisi.
- [x] **Untrusted Content Wrapper:** Semua balasan luar diisolasi dalam tag `<untrusted_email_content>`.
- [x] **Secret Redaction:** Sensor otomatis terhadap string token/kredensial pada pesan masuk.
- [x] **Budget Hard Cap Kill-Switch:** Panggilan model cloud otomatis ditutup jika pemakaian mencapai Rp500.000.

---

## 2. Infrastructure & Service Verification Checklist
- [x] **Local Ollama Daemon:** Berjalan di `http://127.0.0.1:11434` (Model `llama3.2:1b`, `nomic-embed-text`).
- [x] **Qdrant Vector DB:** Berjalan di `http://127.0.0.1:6333` (Koleksi `jagat_indonesia_knowledge`, 768 dimensi).
- [x] **Redis Broker & Locks:** Berjalan di `127.0.0.1:6379`.
- [x] **Live SMTP Gateway:** Google Gmail Port 465 SSL terverifikasi dengan kredensial di `.env`.
- [ ] **Live IMAP Continuous Poller:** Script standalone `src/colony/closer-agent.ts` ada, tetapi belum diikat ke cron scheduler 24/7.
- [ ] **Data Persistence Layer:** Console masih menggunakan in-memory state; perlu sinkronisasi ke disk (`PROSPECT_TRACKER.csv` & `outreach-send-ledger.jsonl`).

---

## 3. Security Boundary Checklist
- [x] Tidak ada `.env` yang terekspos ke frontend (BFF menyembunyikan API key dan token).
- [x] Whitelist pengiriman riil membatasi transmisi hanya ke alamat terverifikasi founder (`faturachmanalkahfi7@gmail.com`).
- [x] Feature Flags (6 toggles) memungkinkan rollback instan jika ditemukan anomali operasional.
