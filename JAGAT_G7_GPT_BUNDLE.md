# JAGAT G7 — COMPREHENSIVE KNOWLEDGE BUNDLE
> **Dokumen Master: PRD, Roadmap, Arsitektur, & Konteks Proyek**  
> *Dipersiapkan khusus untuk transfer konteks lengkap ke GPT Astra / External AI Model.*  
> *Versi Update: Agustus - November 2026 (Sinkronisasi D-051 Local AGI Showcase)*

---

# DAFTAR ISI
1. [RINGKASAN EKSEKUTIF & IDENTITAS PROYEK](#1-ringkasan-eksekutif--identitas-proyek)
2. [PRODUCT REQUIREMENTS DOCUMENT (PRD V1)](#2-product-requirements-document-prd-v1)
3. [ROADMAP & EXECUTION MASTERPLAN (6 FASE & 30/60/90 HARI)](#3-roadmap--execution-masterplan-6-fase--306090-hari)
4. [STRUKTUR ORGANISASI & OPERATING MODEL](#4-struktur-organisasi--operating-model)
5. [ARSITEKTUR TEKNIS & STACK SISTEM](#5-arsitektur-teknis--stack-sistem)
6. [ARMADA AI INTERNAL (JAGAT COLONY)](#6-armada-ai-internal-jagat-colony)
7. [DOWNSTREAM AGENTS (PRODUK HILIR)](#7-downstream-agents-produk-hilir)
8. [KEPUTUSAN STRATEGIS TERKUNCI (DECISION LOG)](#8-keputusan-strategis-terkunci-decision-log)

---

# 1. RINGKASAN EKSEKUTIF & IDENTITAS PROYEK

* **Nama Proyek:** JAGAT G7 (Garuda 7) — *Sovereign Super Intelligence Core*
* **Pencipta Visi, CEO & Chief Architect:** Faturachman Al Kahfi (Mas Fatur)
* **Karakter:** Sistem kecerdasan buatan berdaulat nasional yang dibangun di atas infrastruktur fisik mandiri, memori lokal, dan orkestrasi multi-agen.
* **Filosofi G7 ("7 Minds, One Brain"):**
  * **G = Garuda:** Kedaulatan digital nasional absolut ("Garuda terbang di atas awan, bukan bergantung padanya").
  * **7 = 7 Apex Minds:** Mengagregasi dan mendistilasi pola penalaran dari 7 model AI terbaik dunia (GPT, Claude, Gemini, Groq, Mistral, Llama, DeepSeek) ke dalam satu otak lokal berdaulat.
* **Bukan Sekadar:**
  * ❌ API Wrapper (bukan pembungkus OpenAI/Claude biasa)
  * ❌ Chatbot generik
  * ❌ SaaS publik murahan / mainan
  * ❌ Proyek demonstrasi AGI tanpa eksekusi
* **Melainkan:**
  * ✅ Mesin Sintesis Kognitif Multi-Model Berdaulat
  * ✅ Menjalankan inferensi lokal (Ollama / Qwen / Llama), memori jangka panjang (Qdrant Vector DB), dan memori sesi (Redis)
  * ✅ Didukung oleh **Armada AI (JAGAT Colony)** sebagai tenaga kerja eksekusi mandiri 24/7

---

# 2. PRODUCT REQUIREMENTS DOCUMENT (PRD V1)

*(Diadaptasi dari `ops/JAGAT_G7_PRD_V1.md` dan `ops/JAGAT_G7_PRODUCT_CONTROL_MASTER.md`)*

### 2.1. Visi Produk
Membangun **Sovereign Intelligence Operating System** dari Indonesia: sistem intelijen yang dapat bernalar, mengeksekusi, mengevaluasi, belajar, dan berevolusi mandiri di bawah otoritas founder dan infrastruktur berdaulat.

### 2.2. Mode Produk Saat Ini: *Stealth Intelligence Lab*
* Mematangkan kapabilitas intelijen internal sebelum promosi/marketing publik.
* Mengukur kecerdasan bukan dari panjang context window, melainkan dari **akurasi benchmark, ketepatan memori, dan hasil eksekusi misi (mission outcome)**.
* Jalur komersialisasi diperlakukan sebagai manual service delivery (MVP), bukan SaaS self-serve massal.

### 2.3. Problem Statement
AI tools yang ada di pasaran saat ini memiliki kelemahan mendasar untuk kontrol proyek jangka panjang:
1. **Amnesia Lintas Sesi:** Kehilangan konteks operasional jangka panjang.
2. **Bisa Menjawab, Gagal Mengeksekusi:** Pintar merangkai teks tetapi tidak mampu mengeksekusi tugas terstruktur.
3. **Mengabaikan Decision Lock:** Kerap melanggar keputusan-keputusan arsitektur yang sudah dikunci oleh founder.
4. **Tanpa Self-Evaluation:** Tidak mengevaluasi kualitas dan risiko hasil kerjanya sendiri sebelum diajukan.
5. **Tidak Belajar dari Kegagalan:** Jarang mengubah misi selesai atau bug menjadi memori pelajaran (*lessons*) untuk task masa depan.
6. **Ketergantungan Cloud:** Seluruh data dan intelejensi tersandera di server asing pihak ketiga.

### 2.4. Target Pengguna
1. **Founder (Faturachman Al Kahfi):** Memegang kontrol strategis penuh, approval gate keamanan, komando misi, dan review laporan.
2. **Colony (Armada AI Internal):** Tenaga kerja otonom yang memecah arahan menjadi tiket, mengeksekusi kode, melakukan verifikasi, dan mencatat audit trail.
3. **Internal Operator:** Meninjau penggunaan memori, task, ledger penggunaan, dan tiket komersial manual.
4. **Pengguna Hilir Masa Depan:** Klien downstream agents (Kiting AI, Ting AI, G7 Motherbox) dan mitra enterprise.

### 2.5. Delapan Kapabilitas Inti Produk (C1 – C8)
* **C1. Conversational Cockpit:** Antarmuka obrolan bukan sekadar tempat mengobrol, melainkan kokpit komando untuk pemberian misi (*mission intake*), riset mendalam, instruksi sistem, dan review kerja tim AI.
* **C2. Memory-Grounded Reasoning:** RAG hybrid (dense vector + sparse keyword) yang mengambil korpus terkurasi di Qdrant. Wajib menyertakan sitasi sumber (*citation rendering*); dilarang keras membuat sitasi fiktif untuk jawaban deduksi logis.
* **C3. Mission & Task Execution:** Mesin orkestrasi yang memecah direktif founder menjadi struktur Misi $\to$ Task dengan status lifecycle ketat (`queued` $\to$ `planning` $\to$ `approved` $\to$ `running` $\to$ `review` $\to$ `done`), kriteria penerimaan, dan bukti kerja (*evidence*).
* **C4. Evaluation Layer:** Penilaian kualitas deterministik (*quality score* 0–100) per task pada aspek kelengkapan kriteria, keberadaan bukti, dan konsistensi status.
* **C5. Lesson Memory:** Hasil misi selesai dikonversi menjadi ringkasan pelajaran (*lesson learned*) di Redis (terpisah dari Qdrant) agar modul perencanaan (*planner*) tidak mengulangi kegagalan lama.
* **C6. Verifier Gate:** Pintu verifikasi teknis otomatis (`tsc --noEmit`, test suite, build check). Proposal perubahan kode berisiko tinggi wajib lolos verifikasi sebelum tombol approve founder dapat ditekan.
* **C7. Model Arena:** Pelacakan performa empiris, tingkat keberhasilan, dan latensi model lokal/remote per kategori tugas sebagai dasar rekomendasi perutean model (*model routing advisory*).
* **C8. Downstream Agent Boundary:** Isolasi ketat domain peran, memori, dan tool antara produk Kiting AI, Ting AI, dan Motherbox.

### 2.6. Batasan Tegas (Non-Goals)
* Tidak membangun portal SaaS self-serve dengan payment gateway otomatis di awal.
* Tidak memberikan akses shell terminal bebas tanpa batas ke agen AI (*worker sandbox strictly scoped*).
* Tidak menulis memori operasional/chat sembarangan ke koleksi memori utama Qdrant (*anti-pollution guard*).
* Menolak klaim publik AGI sebelum dibuktikan dengan benchmark dan hasil nyata.

---

# 3. ROADMAP & EXECUTION MASTERPLAN (6 FASE & 30/60/90 HARI)

### 3.1. Enam Fase Eksekusi Makro

| Fase | Nama Fase | Fokus & Deliverable Utama | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Sovereign Ignition** | Menghidupkan stack lokal berdaulat: Next.js UI (port 50012), Express BFF (port 5000), Redis session, Qdrant vector DB, Ollama local inference, dan skrip runbook. | ✅ **Selesai** |
| **Phase 2** | **Sovereign Cognitive Core** | 2A: Identity Lock (anti-vendor drift, Faturachman as founder/architect)<br>2B: Cognitive Protocol Layer (5 sub-layer protokol penalaran)<br>2C: Cognitive Benchmark Suite (7/7 PASS)<br>2D: Founder Operating System (Backlog, Risk Register, Decision Log). | ✅ **Selesai** |
| **Phase 3** | **Sovereign Memory & Ingestion** | Pipeline ingest formal dengan metadata & provenance, semantic chunking, hybrid retrieval (dense + sparse), citation rendering di UI, dan Memory Library UI (13 dokumen inti, 323 points di Qdrant). | ✅ **Selesai (Wave 1 & 2)** |
| **Phase 4** | **Downstream Functional Agents** | Desain boundary Kiting AI, Ting AI, dan Motherbox (T-012/D-042). Implementasi selector mode di antarmuka `/console` (P-005). | ✅ **Selesai (Baseline)** |
| **Phase 5** | **Commercial Gateway (MVP)** | Ledger penggunaan persisten (`usage_events.jsonl`), admin token management, alur intake permintaan invoice manual, dan generator draft invoice Markdown tanpa payment gateway otomatis. | ✅ **Selesai (Manual Path)** |
| **Phase 6** | **Enterprise Scale & Expansion** | Migrasi ke server enterprise (Dell PowerEdge R530), akselerasi cluster GPU, governance enterprise, audit trail korporasi, dan narasi capital expansion / IPO. | ⏳ **Rencana Jangka Panjang** |

### 3.2. Peta 30 / 60 / 90 Hari
* **30 Hari (Selesai):** Identitas terkunci paten, benchmark kognitif lulus 100%, metadata ingestion formal.
* **60 Hari (Selesai):** Semantic chunking audit-ready, hybrid dense+sparse search, rendering sitasi transparan di bubble chat UI.
* **90 Hari (Selesai):** Batasan Kiting/Ting/Motherbox terkunci, persistent usage ledger, admin panel komersial manual, dan paket demo produk awal.

### 3.3. Pivot Strategis Terkini (Keputusan D-051 — Agustus 2026)
* **Status:** **100% Local AGI Showcase di Laptop Nitro 5**.
* **Latar Belakang:** Server VPS staging (`103.190.0.113`) diistirahatkan sementara sebagai target deployment utama.
* **Tujuan:** Membuktikan bahwa seluruh ekosistem kognitif JAGAT G7 (Colony Engine, OpenClaw, Ollama Qwen2.5-Coder, Qdrant, dan Redis) dapat berjalan mandiri, offline, dan aman di mesin lokal milik Founder tanpa ketergantungan server luar.

---

# 4. STRUKTUR ORGANISASI & OPERATING MODEL

JAGAT G7 beroperasi dengan prinsip: **"Tim Manusia Sangat Kecil + Armada AI sebagai Tenaga Kerja Utama"**.

```text
Pak Haero Fiatna
└── President Commissioner (Kapital, Infrastruktur, Skala Enterprise)

Faturachman Al Kahfi
└── Founder, CEO & Chief Architect (Visi Tunggal, Pemegang Keputusan Final, Arsitek Inti)

Saint Christoper Shyandon
└── COO & CPO (Operasi Produk, Desain UI/UX, Presentasi, Komunikasi Klien)

Armada AI (Colony Builder & Sub-Agents)
└── Tenaga Kerja Eksekusi 24/7 (Coding, Refactoring, Audit, QA, Backlog, Runbook)
```

---

# 5. ARSITEKTUR TEKNIS & STACK SISTEM

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS DASHBOARD (Port 50012)                 │
│  - Conversational Cockpit (/console)                                   │
│  - Colony Command Center (/colony)                                    │
│  - Memory Library UI (/memory)                                         │
│  - Admin Operations (/g7-admin)                                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Proxy Internal / Signed Cookie)
┌───────────────────────────────────▼────────────────────────────────────┐
│                        EXPRESS BFF (Port 5000)                        │
│  - Cognitive System Prompts & Identity Guards                          │
│  - Colony Router & Task/Mission Engine                                │
│  - Audit Engine & Verification Gate                                   │
│  - Hybrid Retrieval Orchestrator                                       │
└──────────────┬───────────────────┬───────────────────┬─────────────────┘
               │                   │                   │
┌──────────────▼─────┐      ┌──────▼──────┐     ┌──────▼─────────────────┐
│     REDIS (6379)   │      │ QDRANT (6333)│     │     OLLAMA / LOCAL     │
│ - Session Memory   │      │ - Curated    │     │ - Llama 3 / Qwen Coder │
│ - Colony State     │      │   Vectors    │     │ - Local Embeddings     │
│ - Lesson Memory    │      │ - Provenance │     │ - Remote Worker B Opt  │
│ - Arena Events     │      │   Metadata   │     │   (Tailscale Node)     │
└────────────────────┘      └──────────────┘     └────────────────────────┘
```

---

# 6. ARMADA AI INTERNAL (JAGAT COLONY)

Colony adalah **armada agen AI internal** milik Founder untuk membangun dan merawat JAGAT G7 secara otonom dan terkontrol.

### Unit Kerja Colony:
1. **Colony Director:** Menerjemahkan visi/arahan founder menjadi misi dan memecahnya ke workstream.
2. **Planner / Architect:** Merancang arsitektur solusi, kriteria keberimaan (*acceptance criteria*), dan mengecek mitigasi risiko.
3. **Coder Worker:** Menulis dan memperbaiki kode di dalam lingkungan sandbox yang dibatasi (*byte budget, path security*).
4. **Reviewer:** Melakukan audit kode, evaluasi kualitas deterministik (skor 0–100), dan verifikasi kompilasi.
5. **Reporter:** Membuat rekapitulasi harian/mingguan dan mengirimkan heartbeat berkala (terintegrasi bot WhatsApp Baileys).

### Sumber Otoritas Colony (Urutan Mutlak):
1. Instruksi Langsung Founder (*Faturachman Al Kahfi*)
2. Decision Log Terkunci (`ops/DECISION_LOG.md`)
3. Execution Masterplan (`JAGAT_G7_EXECUTION_MASTERPLAN.md`)
4. Dokumen Induk (`Jagat_G7.md`)
5. Backlog & Dokumen Memori Pendukung

---

# 7. DOWNSTREAM AGENTS (PRODUK HILIR)

| Agen | Peran Utama | Batasan & Refusal Policy |
| :--- | :--- | :--- |
| **Kiting AI** | Universal Task & Productivity Assistant | Dilarang mengeksekusi aksi berbahaya tanpa konfirmasi, dilarang membuka konfigurasi internal Colony/credential. |
| **Ting AI** | Financial Risk Copilot (Analisis Pasar Modal Indonesia) | Wajib menyertakan disclaimer kepatuhan: **bukan nasihat investasi langsung** (*strictly educational & risk analysis*). |
| **G7 Motherbox** | Sovereign API Gateway | Gerbang suplai inferensi/penalaran berdaulat ke aplikasi mitra luar dengan metering dan rate-limit ketat. |

---

# 8. KEPUTUSAN STRATEGIS TERKUNCI (DECISION LOG)

Keputusan yang telah disahkan dan **TIDAK BOLEH DILANGGAR** dalam perancangan maupun pengembangan sistem:

* **D-001:** JAGAT G7 bukan API wrapper dan bukan chatbot generik. Nilai utama ada pada kognisi, memori, dan eksekusi.
* **D-002:** Faturachman Al Kahfi adalah satu-satunya pencipta visi, CEO, dan Chief Architect resmi. Respon identitas wajib konsisten mengunci hal ini.
* **D-003:** Rahasia dapur arsitektur internal tidak boleh dibocorkan ke jawaban publik default.
* **D-004:** Auto-ingest jawaban model ke Qdrant **dimatikan total** untuk mencegah model memakan ulang halusinasinya sendiri (*anti-feedback-loop pollution*).
* **D-005:** Qdrant hanya menerima dokumen pengetahuan yang sengaja dikurasi (*curated knowledge base*).
* **D-006:** Setiap pembaruan prompt atau model wajib melewati *regression benchmark* (Identity, Creator, Cognitive).
* **D-017:** Colony adalah infrastruktur armada kerja internal founder, bukan fitur publik.
* **D-042:** Desain boundary agen hilir (Kiting, Ting, Motherbox) terkunci sebelum ekspansi fitur.
* **D-043:** Jalur komersial awal difokuskan pada manual delivery service (UMKM bot, sovereign assistant, custom web), bukan SaaS self-serve.
* **D-047:** Lesson memory Colony disimpan di Redis terpisah, tidak mengotori koleksi vektor Qdrant.
* **D-049:** Proposal kode yang gagal `tsc --noEmit` dilarang disetujui (*hard verifier gate*).
* **D-050:** Worker AI tidak diberi akses shell eksekusi bebas tanpa pengawasan verifier.
* **D-051:** Pivot strategis Agustus 2026: Pembuktian 100% *Local AGI Showcase* di laptop Nitro 5 milik Founder.

---
*(Dokumen ini merupakan ringkasan utuh bersertifikasi sistem dari ekosistem c:\JAGAT)*

