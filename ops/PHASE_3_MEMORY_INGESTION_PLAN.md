# JAGAT G7 Phase 3 - Sovereign Memory Ingestion Plan

## Status

Status: Phase 3A, Phase 3B, Phase 3C, Phase 3D, Phase 3E, Phase 3F, and Phase 3G implemented for Wave 1 and Wave 2.

Phase 3 Wave 1 dan Wave 2 sudah selesai dari schema sampai citation UI. Total 13 dokumen terkurasi (183 Qdrant points). Sisa pekerjaan menuju Phase 3 penuh adalah ekspansi korpus strategis Wave 3+ sampai minimal 20 dokumen (perlu 7 dokumen tambahan: regulasi, finance, dan founder notes).

## Tujuan Phase 3

Membangun lapisan memori berdaulat JAGAT G7 agar sistem tidak hanya menjawab dari model dasar, tetapi dari korpus pengetahuan milik Faturachman Al Kahfi dan tim inti JAGAT.

Outcome utama:

- Dokumen strategis masuk secara terkurasi.
- Setiap fragmen memori punya metadata dan provenance.
- Retrieval dapat diaudit.
- Jawaban JAGAT dapat mencantumkan sumber.
- Memori tidak tercemar prompt, output model, atau dokumen tanpa identitas sumber.

## Prinsip Phase 3

1. Jangan ingest massal sebelum schema metadata dikunci.
2. Jangan menerima dokumen tanpa provenance.
3. Jangan memasukkan output model sebagai knowledge.
4. Jangan menampilkan citation palsu.
5. Jangan membuat UI ingest yang terlalu bebas tanpa kontrol kualitas.
6. Semua dokumen penting harus punya kategori, owner, tanggal, dan trust level.
7. Phase 3 harus memperkuat otak JAGAT, bukan sekadar menambah file ke Qdrant.

## Subfase Eksekusi

### Phase 3A - Formal Ingestion Schema

Status: Done.

Tujuan:

Menetapkan kontrak metadata wajib untuk setiap dokumen yang masuk ke memori JAGAT.

Scope:

- Backend ingest schema.
- UI ingest metadata fields.
- Validasi minimal metadata.
- Error response jika metadata tidak lengkap.
- Guardrail penolakan prompt/debug/feedback-loop document.

Metadata wajib:

| Field | Wajib | Contoh | Fungsi |
| --- | --- | --- | --- |
| `title` | Ya | JAGAT G7 Technical Blueprint | Nama dokumen yang bisa dibaca manusia |
| `source` | Ya | local-blueprint-v1 | Identitas sumber |
| `category` | Ya | blueprint | Klasifikasi pengetahuan |
| `doc_type` | Ya | pdf, xlsx, md, txt, note | Jenis dokumen |
| `owner` | Ya | Faturachman Al Kahfi | Pemilik/penanggung jawab sumber |
| `created_at` | Ya | 2026-05-20 | Tanggal dokumen atau tanggal ingest jika tidak diketahui |
| `trust_level` | Ya | founder_verified, internal, external_reference | Tingkat kepercayaan |
| `provenance` | Ya | local upload, founder note, roadmap file | Asal-usul dokumen |
| `notes` | Tidak | Milestone versi V5 | Catatan kurasi |

Acceptance criteria:

- API ingest menolak request tanpa metadata wajib.
- UI ingest menyediakan field metadata wajib.
- Response error jelas dan tidak teknis berlebihan.
- Metadata tersimpan pada payload Qdrant untuk setiap chunk.
- Benchmark ingest terkurasi tetap PASS.

Evidence:

- Backend `POST /research/ingest` memakai strict `content + metadata`.
- BFF `POST /api/secure-ingest` meneruskan schema formal.
- UI tab ingest memiliki field title, source, category, doc_type, owner, created_at, trust_level, provenance, notes, dan content.
- `benchmark:cognitive` PASS 10/10 termasuk legacy rejection, required metadata validation, enum/date validation, curated ingest, dan Qdrant pollution check.
- Backend build dan UI build PASS.

Risiko:

- Terlalu banyak field membuat ingest lambat.
- Field tidak konsisten membuat retrieval/citation lemah.
- Dokumen lama tanpa metadata perlu migrasi atau re-ingest.

Owner:

- AI Builder: backend schema, validation, benchmark.
- Saint: UI ingest form.
- Faturachman: standar kategori/trust level final.

### Phase 3B - Kurasi Dokumen Strategis

Status: Done for Wave 1.

Tujuan:

Menentukan dokumen mana yang layak menjadi makanan utama memori JAGAT.

Kategori awal:

- Blueprint
- Roadmap
- Milestone
- Infrastructure
- Product
- Risk and decision
- Finance and commercial
- Regulation and compliance
- Founder notes
- Client/presentation material

Acceptance criteria:

- Ada daftar dokumen prioritas.
- Setiap dokumen punya kategori dan owner.
- Dokumen rahasia diberi trust level yang tepat.
- Dokumen yang tidak jelas sumbernya ditahan.

Output:

- Manifest dokumen strategis.
- Daftar prioritas ingest gelombang 1.

Evidence:

- `ops/PHASE_3B_STRATEGIC_DOCUMENT_MANIFEST.md` dibuat sebagai manifest kurasi manusia.
- `ops/phase3_wave1_manifest.json` dibuat sebagai manifest machine-readable.
- Wave 1 dikunci ke tiga dokumen founder strategic core: Technical Blueprint, Sovereign Roadmap, dan Project Milestones V5.
- Wave 2 dikunci ke sepuluh dokumen operasional: Execution Masterplan, Team Structure, Decision Log, Risk Register, Technical Backlog, Product Backlog, Weekly Execution Loop, 30/60/90 Map, Phase 3 Plan, dan Phase 3B Manifest.
- Setiap dokumen punya title, source, category, doc_type, owner, created_at, trust_level, provenance, local_path, SHA256, dan size_bytes.
- Tidak ada ingest dilakukan pada Phase 3B.

### Phase 3C - Digitalisasi dan Normalisasi Dokumen

Status: Done for Wave 1.

Tujuan:

Mengubah PDF, XLSX, Markdown, TXT, dan catatan manual menjadi format teks bersih yang siap di-chunk.

Scope:

- PDF text extraction.
- XLSX sheet extraction.
- Markdown/TXT normalization.
- Cleaning karakter rusak.
- Struktur heading dipertahankan.

Acceptance criteria:

- Konten utama dokumen terbaca.
- Header/section penting tidak hilang.
- Tabel penting dari XLSX tidak rusak total.
- File hasil normalisasi bisa diaudit sebelum embedding.

Output:

- Normalized text files.
- Extraction report.

Evidence:

- `scripts/phase3c-normalize-wave1.mjs` dibuat sebagai pipeline normalisasi Wave 1.
- `npm run phase3c:normalize` menghasilkan normalized text dan metadata sidecar.
- `ops/phase3c_normalized/` berisi artifact normalized untuk Technical Blueprint, Sovereign Roadmap, dan Project Milestones V5.
- `ops/phase3c_reports/EXTRACTION_REPORT_WAVE1.md` dan `extraction_report_wave1.json` dibuat sebagai report audit.
- Roadmap PDF terdeteksi image-only dan dinormalisasi melalui OCR lokal.
- Wave 2: `scripts/phase3c-normalize-wave2.mjs` menormalisasi 10 dokumen Markdown. Report: `ops/phase3c_reports/EXTRACTION_REPORT_WAVE2.md`.
- Tidak ada ingest Qdrant dilakukan pada Phase 3C.

### Phase 3D - Semantic Chunking

Status: Done for Wave 1.

Tujuan:

Memecah dokumen menjadi fragmen semantik yang cukup kecil untuk retrieval, tetapi cukup utuh untuk konteks.

Policy awal:

- Chunk mengikuti section/heading jika tersedia.
- Chunk tidak memotong tabel penting sembarangan.
- Chunk memiliki overlap terbatas.
- Setiap chunk membawa metadata induk.
- Setiap chunk punya `chunk_index` dan `chunk_id`.

Acceptance criteria:

- Chunk punya ukuran konsisten.
- Chunk tidak kehilangan provenance.
- Retrieval tidak mengambil fragmen kosong/noise.
- Wave 1 menghasilkan chunk yang bisa dibaca manusia dan siap menjadi input Phase 3E.

Output:

- Chunk JSON dan JSONL.
- Chunk report.

Evidence:

- `scripts/phase3d-chunk-wave1.mjs` dibuat sebagai semantic chunking pipeline Wave 1.
- `npm run phase3d:chunk` menghasilkan 55 chunk audit-ready.
- `ops/phase3d_chunks/wave1_chunks.json` dan `wave1_chunks.jsonl` dibuat sebagai artifact chunk.
- `ops/phase3d_reports/CHUNK_REPORT_WAVE1.md` dan `chunk_report_wave1.json` dibuat sebagai report audit.
- Technical Blueprint menghasilkan 14 chunk, Sovereign Roadmap 10 chunk, dan Project Milestones V5 31 chunk.
- Wave 2: `scripts/phase3d-chunk-wave2.mjs` menghasilkan 128 chunk dari 10 dokumen operasional. Report: `ops/phase3d_reports/CHUNK_REPORT_WAVE2.md`.
- Total Wave 1 + Wave 2: 183 chunk audit-ready.
- Validasi chunk PASS: tidak ada chunk tanpa metadata/provenance, tidak ada chunk kosong.
- Tidak ada ingest Qdrant dilakukan pada Phase 3D.

### Phase 3E - Embedding Massal

Status: Done for Wave 1.

Tujuan:

Memasukkan dokumen strategis terkurasi ke Qdrant secara batch, bukan manual satu per satu.

Scope:

- CLI bulk ingest folder.
- Manifest-driven ingest.
- Dry run mode.
- Duplicate detection dasar.
- Ingest report.

Acceptance criteria:

- Folder dokumen bisa di-ingest dari manifest.
- Ingest bisa dijalankan ulang tanpa duplikasi liar.
- Report menampilkan jumlah dokumen, chunk, success, failed.
- Minimal 20 dokumen strategis masuk Qdrant dengan metadata.

Output:

- Bulk ingest CLI.
- Dry-run/idempotency report.
- Force ingest report.
- 55 Qdrant points untuk Wave 1.

Evidence:

- `scripts/phase3e-bulk-ingest-wave1.mjs` dibuat sebagai pipeline embedding massal Wave 1.
- `npm run phase3e:dry-run` tersedia untuk validasi tanpa embedding/upsert.
- `npm run phase3e:ingest` tersedia untuk ingest normal yang skip point existing.
- `npm run phase3e:force-ingest` tersedia untuk re-embed/upsert ulang secara eksplisit.
- Point ID dibuat deterministik dari `chunk_id`, sehingga rerun tidak membuat duplikasi liar.
- Wave 1 berhasil di-embed memakai `nomic-embed-text` dan 55 point di-upsert ke collection `jagat_indonesia_knowledge`.
- Wave 2 berhasil di-embed memakai `nomic-embed-text` dan 128 point di-upsert ke collection yang sama. 0 failure.
- Total: 183 Qdrant points dari 13 dokumen terkurasi.
- `ops/phase3e_reports/FORCE_INGEST_REPORT_WAVE1.md` mencatat force ingest 55 embedded, 55 upserted, 0 failure.
- `ops/phase3e_reports/BULK_INGEST_REPORT_WAVE2.md` mencatat ingest 128 embedded, 128 upserted, 0 failure.
- Retrieval smoke test menemukan chunk Roadmap/Milestone/Blueprint/Decision/Risk dengan skor di atas threshold.

### Phase 3F - Hybrid Search Dense + Sparse

Status: Done for Wave 1.

Tujuan:

Meningkatkan retrieval agar tidak hanya bergantung pada embedding dense, tetapi juga mempertimbangkan keyword/sparse signal.

Scope:

- Dense retrieval dari Qdrant.
- Sparse/keyword prefilter atau rerank sederhana.
- Category/source filter.
- Score threshold policy.

Acceptance criteria:

- Query proyek bisa menemukan dokumen berdasarkan istilah spesifik.
- Query semantik tetap bekerja.
- Filter category/source dapat dipakai untuk audit.
- Retrieval report menampilkan sumber yang dipakai.

Catatan:

Hybrid search boleh dimulai sederhana. Jangan membuat sistem retrieval terlalu kompleks sebelum metadata stabil.

Output:

- Hybrid dense+sparse retrieval di backend.
- Metadata filter untuk `source`, `category`, `doc_type`, dan `trust_level`.
- Context source metadata pada event `meta`.
- Smoke report Phase 3F.

Evidence:

- `src/services/qdrant.ts` mendukung vector search dengan filter dan payload scroll.
- `src/agents/research.ts` menggabungkan dense vector score, sparse keyword score, hybrid rerank, dan filter metadata.
- `POST /research` menerima `filters` opsional untuk audit retrieval.
- `npm run phase3f:smoke` PASS dengan 2 kasus: hybrid retrieval umum dan filter `category=milestone`.
- `ops/phase3f_reports/HYBRID_SEARCH_SMOKE_REPORT.md` dan `hybrid_search_smoke_report.json` dibuat sebagai report audit.
- Context metadata untuk Phase 3G sudah tersedia: title, source, category, score, denseScore, sparseScore, chunkIndex, sectionTitle, retrievalMode, matchedKeywords.
- `npm run benchmark:cognitive` PASS 10/10 setelah Phase 3F.

### Phase 3G - Citation Rendering di UI

Status: Done for Wave 1.

Tujuan:

Membuat jawaban JAGAT dapat diaudit oleh founder dan tim inti melalui sumber yang terlihat.

Scope:

- Backend mengirim daftar source/chunk yang dipakai.
- UI menampilkan citation di bubble jawaban.
- Citation minimal berisi title, source, category, score, dan chunk index.
- Citation tidak muncul jika jawaban murni deduksi tanpa Qdrant.

Acceptance criteria:

- Jawaban RAG mencantumkan sumber.
- Jawaban deduksi tidak memalsukan sumber.
- User bisa membedakan memori terverifikasi dan deduksi logis.
- UI citation ringkas dan tidak mengganggu alur baca.

Output:

- Citation panel di bubble jawaban.
- Citation hanya muncul jika `meta.contextSources` tersedia.
- BFF research siap meneruskan `filters` opsional untuk audit retrieval.
- Report Phase 3G.

Evidence:

- `jagat-ui/src/app/page.tsx` memperluas `ChatMeta` dengan `contextSources`.
- UI menampilkan hingga 5 citation berisi title/source/category/score/dense/sparse/chunk/section/retrieval mode/keyword.
- Citation tidak dirender ketika jawaban tidak memiliki sumber konteks.
- `jagat-ui/src/app/api/secure-research/route.ts` meneruskan `filters` opsional.
- `ops/phase3g_reports/CITATION_RENDERING_REPORT.md` dibuat sebagai report audit.
- `npm run build` di `jagat-ui` PASS.
- Backend `npm run build` PASS.
- Runtime identity prompt dirampingkan agar model tidak menggemakan protokol internal pada jawaban RAG.
- Backend stream guard memotong output jika pola protokol internal mulai bocor.
- `npm run benchmark:identity` PASS 9/9, `npm run test:creator` PASS 6/6, dan `npm run benchmark:cognitive` PASS 10/10 setelah Phase 3G.

## Urutan Kerja Disiplin

1. Phase 3A - Formal Ingestion Schema.
2. Phase 3B - Kurasi Dokumen Strategis.
3. Phase 3C - Digitalisasi dan Normalisasi.
4. Phase 3D - Semantic Chunking.
5. Phase 3E - Embedding Massal.
6. Phase 3F - Hybrid Search.
7. Phase 3G - Citation Rendering UI.

## Gate Sebelum Mulai Coding

Sebelum implementasi Phase 3A dimulai, harus dikunci:

- Daftar metadata wajib.
- Daftar kategori awal.
- Daftar trust level awal.
- Format error response.
- Perubahan endpoint/API contract.
- Acceptance criteria backend dan UI.

## Kategori Awal

| Kategori | Fungsi |
| --- | --- |
| `blueprint` | Arsitektur dan desain sistem |
| `roadmap` | Arah strategis dan fase pembangunan |
| `milestone` | Target, capaian, timeline |
| `infrastructure` | Server, jaringan, GPU, deployment |
| `product` | UI, UX, fitur, packaging |
| `risk` | Risiko dan mitigasi |
| `decision` | Keputusan founder dan arsitektur |
| `commercial` | Pricing, monetisasi, go-to-market |
| `regulation` | Hukum, compliance, kebijakan |
| `founder_note` | Catatan langsung Faturachman |

## Trust Level Awal

| Trust Level | Arti |
| --- | --- |
| `founder_verified` | Disahkan langsung oleh Faturachman |
| `core_team_verified` | Disahkan tim inti |
| `internal_draft` | Draft internal, belum final |
| `external_reference` | Referensi eksternal, bukan sumber kebenaran utama |
| `unknown` | Tidak boleh masuk kecuali untuk staging audit |

## Risiko Utama Phase 3

| ID | Risiko | Mitigasi |
| --- | --- | --- |
| P3-R001 | Metadata tidak konsisten | Schema wajib dan dropdown kategori/trust level |
| P3-R002 | Dokumen rahasia masuk tanpa label | Trust level dan provenance wajib |
| P3-R003 | Chunk noise masuk ke Qdrant | Normalization report dan chunk preview |
| P3-R004 | Citation palsu | Citation hanya dari `contextSources` yang dikirim backend |
| P3-R005 | Ingest massal mencemari memori | Dry run, manifest, duplicate detection |

## Definition of Done Phase 3

Phase 3 dianggap selesai jika:

- Minimal 20 dokumen strategis terkurasi masuk Qdrant. Status: 13/20 tercapai (Wave 1: 3 dokumen, Wave 2: 10 dokumen). Perlu Wave 3 untuk 7 dokumen tambahan.
- Setiap chunk punya metadata dan provenance. Status: tercapai untuk Wave 1 dan Wave 2.
- UI ingest punya field metadata wajib. Status: tercapai.
- Backend menolak ingest tidak lengkap. Status: tercapai.
- Retrieval bisa difilter berdasarkan source/category. Status: tercapai di backend.
- Jawaban RAG menampilkan citation. Status: tercapai di UI.
- Benchmark cognitive tetap PASS setelah ingestion pipeline berubah. Status: tercapai setelah Wave 1 dan Wave 2; perlu diulang setiap ekspansi korpus.
