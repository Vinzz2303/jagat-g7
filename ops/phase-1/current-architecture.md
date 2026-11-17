# JAGAT Phase 1 — Current Architecture & Repository Audit

## 1. Executive Summary
Berdasarkan inspeksi forensik langsung terhadap repositori `jagat-ai-codebase` (bukan sekadar ringkasan eksternal), sistem JAGAT saat ini merupakan arsitektur hybrid yang menggabungkan **Express BFF + Colony Core (`src/index.ts`, `src/colony/*`)**, **Next.js UI (`jagat-ui/`)**, serta **Worker Scripts (`scripts/*.mjs`, `scripts/*.ts`)** yang diorkestrasi oleh `revenue-swarm.ts` dan `scheduler-loop.ts` (C6 Scheduler).

Prinsip utama Phase 1 (**Reuse First**): Seluruh komponen inti yang sudah berjalan dipertahankan, sementara 7 celah reliabilitas, keamanan outbound, state prospek, model routing, dan kontrol biaya diperkuat melalui lapisan modular berpelindung *feature flags*.

---

## 2. Inventaris Service & Komponen Aktual

| Area | File / Lokasi Aktual di Repositori | Kondisi Aktual Hasil Audit | Keputusan Phase 1 |
| :--- | :--- | :--- | :--- |
| **Backend BFF** | `src/index.ts`, `src/colony/routes.ts` | Express.js TypeScript BFF (Port 5000) dengan endpoint Colony, task, mission, dan health check. | **Pertahankan**; tambahkan endpoint Phase 1 Revenue, Policy, Model Router, dan Observability. |
| **Colony Core & C6 Scheduler** | `src/colony/task-engine.ts`, `mission-engine.ts`, `scheduler-loop.ts`, `scheduler-queue.ts` | C6 Scheduler berjalan tiap 60 detik (`DEFAULT_INTERVAL_MS = 60_000`) untuk klaim task otonom (`reporter`, `director`, `planner`, `researcher`). | **Pertahankan**; perbaiki `releaseSchedulerClaim` menjadi *atomic compare-and-delete* dan pasang *distributed campaign lock*. |
| **Revenue Swarm** | `src/colony/revenue-swarm.ts` | Menjalankan siklus 6 tahap via `child_process.exec`: Scout (`prospect-discovery-agent-v1.mjs`, `global-discovery-agent.ts`) → Analyst (`autonomous-revenue-agent-v1.mjs`) → Copywriter (`global-copywriter.ts`) → Delivery (`revenue-outreach-email.mjs --blast-all`) → Closer (`closer-agent.ts`) → Reporter (`voice-engine.ts` + `telegram-adapter.ts`). | **Pertahankan**; cabut mode `--blast-all` tanpa batas, pasang *Outreach Policy Engine* & *Approval Gate* sebelum pengiriman. |
| **Penyimpanan Data (Storage Inventory)** | `ops/revenue/PROSPECT_TRACKER.csv`, `ops/revenue/outreach-send-ledger.jsonl`, `data/usage_events.jsonl`, Redis | **Temuan Penting:** Belum ada database PostgreSQL aktif di kode saat ini. Prospek disimpan di `PROSPECT_TRACKER.csv`, histori kirim di `outreach-send-ledger.jsonl`, dan state task/approval di Redis. | **Pertahankan JSONL & CSV sebagai audit trail**; tambahkan *Lead State Manager* terstruktur dengan 15 status resmi dan log transisi (`outreach_events`). |
| **Outbound Email** | `src/colony/email-adapter.ts`, `scripts/revenue-outreach-email.mjs` | Nodemailer SMTP SSL port 465 (`smtp.gmail.com`). CSV tracker baru ditulis ulang di **akhir loop** pengiriman. | **Perbaiki Defek Kritis:** Pasang *Idempotency Guard* atomik per email (`outreach:{lead_id}:{campaign_id}:{message_type}`) dan status `NEEDS_RECONCILIATION`. |
| **Inbound Reply & Closer** | `src/colony/closer-agent.ts` | Membaca inbox via `imap-simple` (`UNSEEN`), mengevaluasi intent (`POSITIVE`, `NEGATIVE`, `OTHER`) via `HybridRouter.callGeminiSmart`, dan langsung membalas link Calendly jika `POSITIVE`. | **Perkuat Keamanan:** Sanitasi *untrusted email input* (anti-prompt injection), cocokkan ke `lead_id`, terapkan *confidence threshold* ($\ge 0.80$), dan auto-suppress jika `NEGATIVE`/unsubscribe. |
| **Model Router** | `src/colony/model-router.ts`, `src/services/hybrid-router.ts`, `src/services/ollama.ts` | Terpecah dua: `model-router.ts` hanya bersifat *advisory* (Garuda Ladder L1–L5 ke Server B `100.107.244.82` yang sedang offline), sedangkan `hybrid-router.ts` memanggil Groq (`llama3-8b-8192`), Gemini (`gemini-2.5-flash`), atau fallback Ollama (`qwen2.5:7b`). | **Satukan & Standarisasi:** Buat *Task-Based Model Router* (`classification`, `extraction_json`, `email_generation`, `complex_reasoning`, `coding`, `embedding`) dengan timeout, fallback, circuit breaker, dan *Usage & Cost Tracker* (hard cap Rp350.000–Rp500.000). |
| **Telegram Bot** | `src/colony/telegram-bot.ts`, `src/colony/telegram-adapter.ts` | Dual bot Telegraf (`botJagat` God Mode & `botTings` Analyst Mode) + pengiriman Voice Note & rekap teks. | **Ekstensi UX Approval:** Tambahkan preview draft prospek baru dengan aksi `Approve`, `Edit`, `Skip/Suppress`, dan `Pause Campaign`. |
| **RAG & Vector Memory** | `src/services/qdrant.ts`, `src/colony/memory-reader.ts` | Native fetch Qdrant client untuk koleksi `jagat_indonesia_knowledge` (embedding `nomic-embed-text`, dimensi 768). | **Validasi & Graceful Degradation:** Tambahkan health check, validasi dimensi 768, uji retrieval, dan fallback non-RAG jika Qdrant offline. |

---

## 3. Temuan Audit Defek Kritis (Sebelum Phase 1)

1. **Risiko Email Ganda (Duplicate Send) Saat Crash/Restart**:
   Pada `scripts/revenue-outreach-email.mjs`, fungsi `sendEmail()` dipanggil di dalam perulangan `for (const lead of eligibleLeads)`, tetapi pembaruan status `lead.status = 'emailed'` ke `PROSPECT_TRACKER.csv` baru dilakukan setelah seluruh loop selesai. Jika proses berhenti di tengah loop, eksekusi berikutnya akan mengirim ulang email ke prospek yang sama.
2. **Otonomi Penuh Tanpa Gate Approval pada Prospek Baru**:
   Pada `src/colony/revenue-swarm.ts` baris 56, Delivery Agent dipanggil dengan flag `--blast-all` (`// OTONOMI PENUH: Langsung kirim!`). Blueprint Phase 1 mewajibkan default `APPROVAL` untuk prospek baru.
3. **Kerentanan Prompt Injection & Absennya Confidence Threshold pada `closer-agent.ts`**:
   Isi email masuk (`text`) disisipkan mentah ke dalam prompt LLM tanpa batas isolasi *untrusted input*, tidak ada pencocokan ke database prospek, tidak ada batas *confidence score*, dan balasan `NEGATIVE` (unsubscribe) belum otomatis memasukkan alamat ke daftar *suppression*.
4. **Non-Atomic Lock Release pada `scheduler-queue.ts`**:
   Fungsi `releaseSchedulerClaim` membaca `redis.get(claim.lockKey)` lalu memanggil `redis.del(claim.lockKey)` secara terpisah (bukan *atomic compare-and-delete*), sehingga berisiko menghapus lock milik worker lain jika TTL habis tepat di antara `GET` dan `DEL`.

---

## 4. Variabel Environment (Hanya Nama Variabel — Tanpa Nilai Rahasia)
Sesuai aturan keamanan Phase 1, berikut adalah daftar nama variabel environment yang digunakan (tanpa pernah mencetak nilainya):
- `PORT`, `NODE_ENV`
- `REDIS_URL`, `QDRANT_HOST`, `QDRANT_COLLECTION`
- `OLLAMA_HOST`, `OLLAMA_REMOTE_URL`, `OLLAMA_REMOTE_ENABLED`, `INFERENCE_MODEL`, `EMBEDDING_MODEL`
- `GEMINI_API_KEY`, `GROQ_API_KEY`
- `EMAIL_ENABLED`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `CALENDLY_LINK`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN_TINGS`, `TELEGRAM_FOUNDER_CHAT_ID`
- `C6_SCHEDULER_ENABLED`, `C6_SCHEDULER_INTERVAL_MS`, `C6_REPORTER_CHECK_MS`, `C6_HEARTBEAT_MS`
- **Variabel Baru Phase 1 (Feature Flags & Policy Caps)**:
  - `FF_OUTREACH_POLICY_ENGINE`
  - `FF_IDEMPOTENCY_GUARD`
  - `FF_LEAD_STATE_MACHINE`
  - `FF_MODEL_COST_ROUTER`
  - `FF_INBOUND_SAFETY_GUARD`
  - `FF_RAG_HEALTH_GUARD`
  - `JAGAT_OUTBOUND_MODE` (`PREPARE` | `APPROVAL` | `CONTROLLED_AUTO_SEND`)
  - `JAGAT_GLOBAL_PAUSE` (`true` | `false`)
  - `JAGAT_BUDGET_HARD_CAP_IDR` (default `500000`)
  - `JAGAT_DAILY_ALERT_IDR` (default `35000`)
