# JAGAT G7 Founder Operating System

Folder ini adalah pusat kendali operasional JAGAT G7.

Tujuannya sederhana: Faturachman Al Kahfi bisa melihat keputusan, risiko, backlog, dan langkah berikutnya tanpa harus membangun organisasi manusia yang gemuk.

## File Kendali

- `DECISION_LOG.md` - keputusan strategis dan arsitektural yang sudah dikunci.
- `RISK_REGISTER.md` - risiko utama, severity, mitigation, dan owner.
- `TECHNICAL_BACKLOG.md` - pekerjaan teknis backend, memory, infra, benchmark, dan agent.
- `PRODUCT_BACKLOG.md` - pekerjaan UI, packaging, pricing, client-readiness, dan monetisasi.
- `WEEKLY_EXECUTION_LOOP.md` - ritme kerja mingguan founder + armada AI.
- `EXECUTION_MAP_30_60_90.md` - peta kerja 30/60/90 hari.
- `PHASE_3_MEMORY_INGESTION_PLAN.md` - rencana detail Phase 3 untuk schema ingest, kurasi dokumen, chunking, embedding, hybrid search, dan citation.
- `PHASE_3B_STRATEGIC_DOCUMENT_MANIFEST.md` - manifest kurasi dokumen strategis Wave 1.
- `phase3_wave1_manifest.json` - manifest machine-readable untuk Phase 3C/3E.
- `phase3c_normalized/` - artifact normalized text dan metadata sidecar hasil Phase 3C.
- `phase3c_reports/` - extraction report JSON/Markdown hasil Phase 3C.
- `phase3d_chunks/` - artifact chunk JSON/JSONL hasil Phase 3D.
- `phase3d_reports/` - chunk report JSON/Markdown hasil Phase 3D.
- `phase3e_reports/` - report dry-run/idempotency dan bulk ingest Qdrant hasil Phase 3E.
- `phase3f_reports/` - report smoke test hybrid search hasil Phase 3F.
- `phase3g_reports/` - report citation rendering UI hasil Phase 3G.

## Aturan Operasi

1. Tidak ada eksekusi fitur tanpa masuk backlog.
2. Tidak ada perubahan prompt/model tanpa benchmark.
3. Tidak ada ingest massal tanpa metadata dan provenance.
4. Tidak ada jawaban publik yang membocorkan rahasia dapur.
5. Tidak ada auto-ingest output model ke Qdrant.
6. Founder memegang keputusan final.

## Status Phase 2D

Status: aktif.

Phase 2D dianggap hijau jika semua file kendali di atas ada, punya owner/status/risiko, dan dipakai sebagai dasar sebelum masuk Phase 3.

## Status Phase 3

Status: Phase 3A, 3B, 3C, 3D, 3E, 3F, dan 3G selesai untuk Wave 1.

Phase 3 dimulai dari `PHASE_3_MEMORY_INGESTION_PLAN.md`. Phase 3A sudah mengunci schema metadata/provenance. Phase 3B sudah mengurasi Wave 1: Blueprint, Roadmap, dan Milestone. Phase 3C sudah menormalisasi dokumen Wave 1 dan membuat extraction report. Phase 3D sudah memecah Wave 1 menjadi 55 chunk audit-ready. Phase 3E sudah meng-embed dan meng-upsert 55 chunk ke Qdrant dengan point ID deterministik. Phase 3F sudah menambahkan hybrid search dense + sparse dengan filter metadata. Phase 3G sudah menampilkan citation UI dari sumber yang benar-benar dipakai. Langkah berikutnya adalah ekspansi korpus strategis Wave 2.
