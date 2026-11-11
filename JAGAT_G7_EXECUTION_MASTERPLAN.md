# JAGAT G7 Execution Masterplan

## Status Dokumen

Dokumen ini adalah pedoman kerja utama untuk membangun JAGAT G7 sebagai Sovereign Super Intelligence Core. Dokumen ini bukan spesifikasi final produk, melainkan peta eksekusi agar pembangunan berjalan terstruktur, disiplin, dan tidak berubah menjadi proyek acak.

## Prinsip Utama

JAGAT G7 bukan API wrapper, bukan chatbot biasa, bukan Artificial Intelligence generik, dan bukan proyek AGI demonstratif.

JAGAT G7 adalah Sovereign Super Intelligence System: sistem intelijen berdaulat yang dibangun di atas infrastruktur fisik milik sendiri, memori lokal, orkestrasi mandiri, dan protokol penalaran yang dikembangkan secara bertahap.

Motto arsitektur internal: model dasar hanya komponen inferensi. Arsitektur kognitif, memori, identitas, protokol penalaran, perilaku, dan struktur eksekusi JAGAT G7 dibangun oleh Faturachman Al Kahfi bersama sistem kerja AI internal. Ini adalah rahasia dapur dan tidak boleh menjadi jawaban publik default.

## Operating Model Tim Inti Kecil + Armada AI

Tujuan operasional proyek ini adalah memungkinkan Faturachman Al Kahfi membangun dan menjalankan JAGAT dengan tim manusia sangat kecil dan armada AI sebagai tenaga kerja utama.

Faturachman Al Kahfi memegang:

- Visi strategis
- Keputusan final
- Standar produk
- Arah komersial
- Prioritas besar

Tim inti manusia memegang:

- Kapital dan akses infrastruktur
- Kesiapan server, jaringan, dan GPU
- Produk, UI/UX, data, presentasi, dan relasi klien

AI Builder dan Project Manager memegang:

- Perencanaan fase
- Pemecahan tugas
- Audit arsitektur
- Dokumentasi teknis
- Eksekusi implementasi saat disetujui
- Verifikasi hasil
- Deteksi risiko
- Penyusunan backlog

Posisi operasional AI Builder: asisten dan karyawan AI pribadi Faturachman Al Kahfi. Struktur kerja inti sengaja tidak bergantung pada karyawan manusia yang banyak; leverage utama datang dari Faturachman sebagai founder/architect dan armada AI sebagai tenaga eksekusi.

Aturan kerja: jangan coding sebelum fase, tujuan, acceptance criteria, dan risiko dipahami.

## North Star

JAGAT G7 harus berkembang melalui empat lapisan inti:

1. Infrastruktur berdaulat
2. Memori berdaulat
3. Penalaran berdaulat
4. Eksekusi berdaulat

Setiap pekerjaan baru harus menjawab minimal satu pertanyaan:

- Apakah ini memperkuat infrastruktur?
- Apakah ini memperkaya memori?
- Apakah ini meningkatkan kualitas penalaran?
- Apakah ini membuat Faturachman dan tim inti kecil lebih mampu mengeksekusi dengan leverage AI?

Jika tidak, pekerjaan ditunda.

## Fase Eksekusi

### Phase 1: Sovereign Ignition

Status: selesai.

Tujuan fase ini adalah memastikan stack dasar hidup secara lokal dan berdaulat.

Komponen utama:

- Bare-metal Windows/Ryzen staging server
- Next.js UI pada port 50012
- Express BFF pada port 5000
- Redis active/session memory
- Qdrant vector memory
- Ollama local inference engine
- Supabase token registry
- Firewall dan endpoint publik

Definition of Done:

- UI dapat diakses dari IP publik
- Backend health operational
- Redis, Qdrant, dan Ollama tersambung
- RAG pipeline dapat mengirim SSE token
- Token registry berjalan

### Phase 2: Sovereign Cognitive Core

Status: selesai.

Tujuan fase ini adalah membangun otak awal JAGAT agar tidak menjadi wrapper.

Subfase:

#### Phase 2A: Identity Lock

Status: selesai, dipoles ulang pada 20 Mei 2026 setelah audit identitas founder.

Tujuan:

- JAGAT tidak pernah mengaku sebagai Codex, ChatGPT, OpenAI, atau model vendor lain.
- Semua respons memakai identitas JAGAT G7.
- Bahasa default adalah Indonesia profesional, tajam, dan tegas.
- Faturachman Al Kahfi terkunci sebagai pencipta visi, CEO, Chief Architect, dan otoritas arsitektural utama JAGAT G7.
- JAGAT menjelaskan bahwa dirinya adalah asisten dan karyawan AI pribadi Faturachman Al Kahfi.
- JAGAT menjaga rahasia dapur arsitektur internal dan tidak membocorkan detail model dasar, struktur kognitif internal, atau mekanisme eksekusi kecuali Faturachman meminta audit teknis eksplisit.

Deliverable:

- Hard system prompt di service layer
- Identity regression test
- Prompt untuk pertanyaan identitas
- Guardrail terhadap hallucinated identity

Definition of Done:

- Pertanyaan "siapa kamu?" dijawab sebagai JAGAT G7
- Pertanyaan "siapa pembuatmu?" dijawab dengan Faturachman Al Kahfi sebagai pencipta/otoritas resmi
- Tidak ada referensi Codex/OpenAI kecuali dalam konteks teknis internal yang diminta founder
- Tidak ada referensi figur eksternal sebagai pembuat, pemilik, bos, majikan, atau otoritas resmi
- UI research pipeline mengikuti identitas yang sama

Evidence:

- Identity policy dipusatkan di `src/prompts/identity.ts`
- Payload Ollama selalu menerima sovereign system prompt melalui service layer
- Endpoint `/research` memiliki fast-path deterministik untuk pertanyaan identitas
- Benchmark `npm run benchmark:identity` diperketat: wajib menyebut Faturachman Al Kahfi dan menolak sisa klaim figur eksternal

#### Phase 2B: Cognitive Protocol Layer

Status: selesai, dipoles ulang pada 20 Mei 2026 setelah audit protokol kognitif.

Tujuan:

- Membuat protokol berpikir JAGAT yang konsisten.
- Memisahkan jawaban berbasis memori Qdrant dari deduksi logis.
- Mengarahkan deduksi untuk memperkuat visi, keputusan, dan eksekusi strategis Faturachman Al Kahfi dalam pembangunan JAGAT G7.

Deliverable:

- Master system prompt berlapis (`src/prompts/cognitive.ts`)
- Memory-first answering policy (P1: Qdrant → P2: Deduksi → P3: Penolakan)
- Deduction policy dengan penanda `[Deduksi Logis — Tanpa Konteks Qdrant]`
- Refusal policy dengan format penolakan standar
- Executive answer format (`## ANALISIS DIREKTIF RISET` berlapis)
- Technical answer format (`## ANALISIS TEKNIS`)
- Risk/copilot answer format (`## PENILAIAN RISIKO BERDAULAT`)
- Auto-detection mode: `detectAnswerMode()` — executive/technical/risk/general
- Creator question routing ke `JAGAT_CREATOR_RESPONSE` (menyebut Faturachman Alkahfi)
- Extended `isIdentityQuestion()` — 40+ keyword markers (ID + EN)

Definition of Done:

- Jika konteks Qdrant tersedia, jawaban memprioritaskan konteks itu.
- Jika data tidak tersedia, JAGAT menyatakan keterbatasan lalu berdeduksi.
- Jawaban tidak mengarang sumber.
- Tidak ada sisa instruksi runtime yang memosisikan figur eksternal sebagai otoritas proyek.

Evidence:

- `src/prompts/cognitive.ts` — Cognitive Protocol Layer dengan 5 sub-layer
- `src/agents/research.ts` — menggunakan `buildCognitiveSystemPrompt(detectAnswerMode(topic))`
- Creator questions ("siapa pembuatmu", "who made you", "faturachman") → fast-path deterministic JAGAT_CREATOR_RESPONSE
- `npm run build` sukses — TypeScript compile zero errors
- Identity benchmark wajib PASS dengan 7 prompt: identitas, anti-Codex/OpenAI, creator, dan Faturachman
- Creator test wajib PASS 4/4: semua respons menyebut Faturachman Al Kahfi dan tidak menyebut figur eksternal sebagai otoritas proyek

#### Phase 2C: Cognitive Benchmark Suite

Status: selesai pada 20 Mei 2026.

Tujuan:

- Menguji apakah JAGAT stabil secara identitas, reasoning, retrieval, dan format.

Deliverable:

- Test set identitas
- Test set reasoning strategis
- Test set Qdrant-grounded answer
- Test set hallucination refusal
- Test set latency/token streaming
- Test curated ingest sebagai mulut knowledge
- Test larangan feedback-loop sebagai sumber memori

Definition of Done:

- Ada daftar prompt uji
- Ada expected behavior
- Ada catatan pass/fail
- Perubahan prompt/model tidak boleh dianggap selesai tanpa melewati benchmark ini

Evidence:

- `scripts/cognitive-benchmark.mjs` dibuat sebagai benchmark utama Phase 2C.
- `package.json` memiliki script `npm run benchmark:cognitive`.
- Benchmark mencakup health backend, identitas publik, mission answer, rahasia arsitektur, penolakan feedback-loop ingest, curated ingest RAG, dan kebersihan Qdrant.
- `npm run benchmark:cognitive` PASS 7/7.
- Ingest tetap berfungsi sebagai mulut pengetahuan terkurasi; yang dimatikan hanya auto-ingest output model agar JAGAT tidak memakan ulang jawaban/prompt sendiri.

#### Phase 2D: Founder and Core Team Operating System

Status: selesai pada 20 Mei 2026; audit ulang PASS setelah sinkronisasi backlog dan UI polish.

Tujuan:

- Membuat JAGAT membantu Faturachman dan tim inti kecil bekerja seperti organisasi besar dengan leverage AI.

Deliverable:

- Decision log
- Risk register
- Technical backlog
- Product backlog
- Weekly execution loop
- 30/60/90 day execution map

Definition of Done:

- Founder dapat melihat pekerjaan berikutnya tanpa bingung
- Setiap task punya owner, status, risiko, dan acceptance criteria
- Tidak ada eksekusi fitur tanpa masuk backlog

Evidence:

- `ops/README.md` dibuat sebagai pusat kendali Founder Operating System.
- `ops/DECISION_LOG.md` mencatat keputusan strategis dan arsitektural yang sudah dikunci.
- `ops/RISK_REGISTER.md` mencatat risiko, severity, probabilitas, mitigasi, owner, dan status.
- `ops/TECHNICAL_BACKLOG.md` menjadi backlog teknis lintas fase.
- `ops/PRODUCT_BACKLOG.md` menjadi backlog produk/UI/komersial.
- `ops/WEEKLY_EXECUTION_LOOP.md` mendefinisikan ritme kerja mingguan founder + armada AI.
- `ops/EXECUTION_MAP_30_60_90.md` mendefinisikan peta eksekusi 30/60/90 hari.
- Backlog Phase 2D disinkronkan menjadi Done setelah audit 20 Mei 2026.
- Login/front page dipoles agar tidak memakai terminal simulator, tidak memakai logo/proxy Google, dan menampilkan demo produk animatif Riset/Ingest/Memori/Eksekusi.
- Benchmark aktual: `benchmark:identity` PASS 9/9, `test:creator` PASS 6/6, `benchmark:cognitive` PASS 7/7.

### Phase 3: Sovereign Memory Ingestion

Status: Phase 3A, Phase 3B, Phase 3C, Phase 3D, Phase 3E, Phase 3F, dan Phase 3G selesai untuk Wave 1 dan Wave 2. Total 13 dokumen terkurasi (192 Qdrant points).

Tujuan fase ini adalah mengisi otak JAGAT dengan korpus milik sendiri.

Subfase:

- Phase 3A - Formal Ingestion Schema: metadata dan provenance wajib sebelum ingest massal. Status: selesai.
- Phase 3B - Kurasi Dokumen Strategis: memilih dokumen yang layak menjadi memori utama. Status: selesai untuk Wave 1.
- Phase 3C - Digitalisasi dan Normalisasi Dokumen: mengubah PDF/XLSX/MD/TXT menjadi teks bersih. Status: selesai untuk Wave 1.
- Phase 3D - Semantic Chunking: memecah dokumen menjadi fragmen semantik yang dapat diaudit. Status: selesai untuk Wave 1.
- Phase 3E - Embedding Massal: ingest batch berbasis manifest ke Qdrant. Status: selesai untuk Wave 1.
- Phase 3F - Hybrid Search Dense + Sparse: retrieval memakai sinyal semantik dan keyword. Status: selesai untuk Wave 1.
- Phase 3G - Citation Rendering di UI: jawaban RAG menampilkan sumber yang dipakai. Status: selesai untuk Wave 1.

Dokumen kendali detail:

- `ops/PHASE_3_MEMORY_INGESTION_PLAN.md`
- `ops/PHASE_3B_STRATEGIC_DOCUMENT_MANIFEST.md`
- `ops/phase3_wave1_manifest.json`
- `ops/phase3c_normalized/`
- `ops/phase3c_reports/EXTRACTION_REPORT_WAVE1.md`
- `ops/phase3d_chunks/wave1_chunks.json`
- `ops/phase3d_reports/CHUNK_REPORT_WAVE1.md`
- `ops/phase3e_reports/FORCE_INGEST_REPORT_WAVE1.md`
- `ops/phase3e_reports/DRY_RUN_REPORT_WAVE1.md`
- `ops/phase3f_reports/HYBRID_SEARCH_SMOKE_REPORT.md`
- `ops/phase3g_reports/CITATION_RENDERING_REPORT.md`

Definition of Done:

- Setiap chunk punya source, kategori, tanggal, dan provenance
- Jawaban bisa mencantumkan sumber
- Retrieval relevan dan dapat diaudit
- Tidak ada dokumen penting yang masuk tanpa metadata

Audit pra-Phase 3:

- Endpoint ingest sekarang strict menerima `content + metadata`.
- UI ingest sekarang meminta title, source, category, doc_type, owner, created_at, trust_level, provenance, notes, dan content.
- Metadata formal seperti title, doc_type, owner, created_at, trust_level, provenance, dan notes sudah diterapkan; notes opsional.
- Citation rendering di UI belum tersedia.
- Phase 3B sudah mengunci Wave 1: Technical Blueprint, Sovereign Roadmap, dan Project Milestones V5.
- Phase 3C sudah menormalisasi Wave 1 menjadi text artifact dan report audit; Roadmap PDF memakai OCR karena image-only.
- Phase 3D sudah menghasilkan 55 chunk audit-ready: Technical Blueprint 14 chunk, Sovereign Roadmap 10 chunk, dan Project Milestones V5 31 chunk.
- Phase 3E sudah mengisi Qdrant dengan 55 point deterministik dari Wave 1 dan membuktikan rerun idempotent.
- Benchmark kognitif setelah Phase 3E PASS 10/10.
- Phase 3F sudah mengaktifkan hybrid dense+sparse retrieval, filter metadata, dan `contextSources` untuk calon citation.
- Benchmark kognitif setelah Phase 3F PASS 10/10.
- Phase 3G sudah menampilkan citation dari `contextSources` di UI dan tidak menampilkan citation palsu saat konteks kosong.
- Runtime identity prompt sudah dirampingkan dan stream guard ditambahkan agar protokol internal tidak bocor saat model kecil mulai menggemakan instruksi.
- Benchmark setelah Phase 3G: identity PASS 9/9, creator PASS 6/6, cognitive PASS 10/10.
- Wave 2 menambahkan 10 dokumen operasional (Masterplan, Team Structure, Decision Log, Risk Register, Technical Backlog, Product Backlog, Weekly Loop, 30/60/90 Map, Phase 3 Plan, Phase 3B Manifest) menghasilkan 137 chunk baru setelah restrukturisasi tim.
- Total memory berdaulat: 13 dokumen, 192 Qdrant points.
- Pekerjaan berikutnya adalah ekspansi korpus strategis Wave 3+ hingga 20 dokumen dan memory library UI.

Urutan disiplin:

1. Kunci schema metadata dan provenance.
2. Tambahkan field metadata di UI ingest.
3. Validasi backend agar dokumen tanpa metadata ditolak.
4. Simpan metadata ke Qdrant untuk setiap chunk.
5. Baru lanjut kurasi, normalisasi, chunking, embedding massal, hybrid search, dan citation rendering.

### Phase 4: Downstream Functional Agents

Status: rencana setelah memory layer matang.

Tujuan fase ini adalah memecah JAGAT menjadi agen hilir yang punya fungsi produk nyata.

Agen awal:

- Kiting AI: universal task assistant
- Ting AI: financial risk copilot
- G7 Motherbox: sovereign API gateway

Definition of Done:

- Setiap agent punya persona, domain, tools, memory scope, dan batasan
- Agent tidak bercampur sembarangan
- Routing antar-agent jelas
- UI membedakan mode agent

### Phase 5: Commercial Gateway

Status: rencana komersial.

Tujuan fase ini adalah membuat JAGAT dapat dimonetisasi.

Komponen:

- Token registry
- Usage metering
- Subscription tiers
- Midtrans payment gateway
- API key management
- Admin dashboard

Definition of Done:

- User dapat membeli akses
- Sistem dapat menghitung penggunaan
- Token dan tier dapat dikelola
- Revenue path jelas

### Phase 6: Enterprise Scale and Capital Expansion

Status: visi jangka panjang.

Tujuan fase ini adalah membawa JAGAT dari sistem lokal menjadi aset enterprise dan modal.

Komponen:

- Migrasi Dell PowerEdge R530
- GPU inference acceleration
- Multi-node readiness
- Governance dokumentasi
- Audit trail
- Enterprise deployment package
- IPO/capital market narrative

Definition of Done:

- Infrastruktur siap skala enterprise
- Dokumen teknis dan komersial dapat dipresentasikan
- Unit ekonomi produk dapat dijelaskan
- Roadmap capital expansion realistis

## Workflow Harian

Setiap sesi kerja mengikuti urutan:

1. Tentukan fase aktif
2. Tentukan tujuan sesi
3. Tulis acceptance criteria
4. Identifikasi risiko
5. Eksekusi hanya task yang disetujui
6. Verifikasi hasil
7. Update backlog atau decision log

## Aturan Anti-Kacau

- Jangan membuat fitur baru jika identitas dan reasoning belum stabil.
- Jangan ingest data massal tanpa metadata.
- Jangan komersialisasi sebelum usage metering jelas.
- Jangan membangun banyak agent sebelum routing dan memory scope selesai.
- Jangan mengganti model tanpa benchmark.
- Jangan mengubah arsitektur hanya karena tren.
- Jangan membuat JAGAT bergantung pada API vendor eksternal untuk fungsi inti.

## Backlog Prioritas Awal

Prioritas 1:

- Finalisasi identity lock (selesai)
- Susun master system prompt berlapis
- Buat benchmark identitas dan hallucination

Prioritas 2:

- Buat founder operating system
- Buat decision log
- Buat technical backlog
- Buat risk register

Prioritas 3:

- Rancang ingestion pipeline formal
- Tentukan schema metadata dokumen
- Tentukan chunking policy

Prioritas 4:

- Desain agent boundary untuk Kiting AI dan Ting AI
- Rancang G7 Motherbox sebagai gateway

## Format Task Standar

Setiap task harus memiliki:

- ID task
- Fase
- Tujuan
- Scope
- File atau modul terdampak
- Risiko
- Acceptance criteria
- Status

Contoh:

```text
Task ID: G7-P2A-001
Fase: Phase 2A - Identity Lock
Tujuan: Memastikan semua output research mengidentifikasi diri sebagai JAGAT G7
Scope: Backend Ollama service dan prompt layer
Risiko: Prompt terlalu panjang menurunkan latency
Acceptance Criteria: 10/10 prompt identitas dijawab konsisten sebagai JAGAT G7
Status: Planned
```

## Keputusan Strategis Saat Ini

**[UPDATE AGUSTUS 2026 - PIVOT 100% LOCAL AGI SHOWCASE]**
Berdasarkan Keputusan D-051, fokus eksekusi saat ini bergeser secara radikal: **Infrastruktur VPS 103.190.0.113 dihentikan sementara sebagai target deployment utama.**
Seluruh pengembangan, operasional Colony, dan eksekusi agentic AI (termasuk Ollama dengan Qwen2.5-Coder) kini berpusat 100% secara lokal (offline) di laptop Nitro 5 milik Founder. Ini bertujuan untuk membuktikan Sovereign AGI dapat dikendalikan penuh dari mesin lokal.

Fokus eksekusi berikutnya adalah stabilisasi eksekusi *Local AGI Showcase* di laptop Founder dan persiapan Phase 4: Downstream Functional Agents secara lokal.

Urutan kerja yang sudah diselesaikan:

1. Phase 2A - Identity Lock (selesai)
2. Phase 2B - Cognitive Protocol Layer (selesai)
3. Phase 2C - Cognitive Benchmark Suite (selesai)
4. Phase 2D - Founder and Core Team Operating System (selesai)
5. Phase 3 - Sovereign Memory Ingestion Wave 1 + Wave 2 (selesai, 13/20 dokumen)
6. **Pivot Eksekusi Lokal** - Migrasi keseluruhan arsitektur JAGAT ke environment lokal (Nitro 5) selesai dieksekusi.

## Catatan Founder

JAGAT G7 dibangun untuk menjadi mesin super intelligence berdaulat karya anak bangsa. Tujuan akhirnya bukan sekadar menjawab pertanyaan, tetapi membantu Faturachman Al Kahfi dan tim inti kecil membangun, mengelola, mengeksekusi, dan mengkomersialisasikan sistem intelijen nasional dengan leverage AI maksimal tanpa struktur organisasi gemuk.
