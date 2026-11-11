# JAGAT G7 Product Backlog

| ID | Phase | Task | Owner | Risiko | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | 2D | Founder dashboard docs. | AI Builder | Founder sulit melihat next action. | Ops folder lengkap dan mudah dibaca. | Done |
| P-002A | 2D | Login/product front page polish. | Saint + AI Builder | UI terasa statis, terlalu teknis, atau membawa jejak vendor asing. | Login tidak memakai Google/proxy, tidak memakai terminal animation, dan memiliki demo produk animatif yang menjelaskan Riset/Ingest/Memori/Eksekusi. | Done |
| P-002 | 3A | Ingest UI metadata fields. | Saint + AI Builder | Data masuk tanpa provenance. | UI ingest punya title, source, category, doc_type, owner, created_at, trust_level, provenance, notes. | Done |
| P-003 | 3E/3G | Memory library view. | Saint + AI Builder | Founder tidak tahu isi Qdrant. | UI `/memory` menampilkan daftar dokumen/chunk/source, provenance, trust level, kategori, wave, dan SHA dari artifact memory. | Done |
| P-004 | 3G | Source citation in answer bubble. | Saint + AI Builder | Jawaban sulit dipercaya. | Jawaban RAG menampilkan sumber tanpa memalsukan citation untuk jawaban deduksi. | Done |
| P-004A | 3B | Strategic document manifest UX. | Saint + AI Builder | Kurasi dokumen tidak terlihat oleh founder. | Ada format manifest dokumen strategis gelombang 1 dengan status curated/hold/reject. | Done |
| P-005 | 4 | Agent mode selector. | Saint + AI Builder | Pengguna bingung memilih fungsi. | UI membedakan Research, Kiting, Ting, Motherbox; mode diteruskan ke backend dan prompt boundary. | Done |
| P-006 | 5 | Pricing and token usage UX. | Saint + AI Builder | Monetisasi sulit dipahami. | User melihat tier, quota, usage, expiry. | Done - MVP with persistent usage ledger |
| P-007 | 5 | Admin token operations polish. | Saint + AI Builder | Operasi token manual dan riskan. | Admin bisa create/suspend/extend token. | Done |
| P-009 | 5 | Manual commercial gateway intake. | Saint + AI Builder | Pricing page bisa dikira payment gateway penuh. | User bisa request invoice manual; admin bisa melihat request di terminal SOVEREIGN; tidak ada payment otomatis. | Done |
| P-010 | 5 | Manual invoice draft UX. | Saint + AI Builder | Admin bisa salah mengira invoice draft sebagai payment confirmation atau token activation. | `/g7-admin` can generate/copy Markdown invoice draft from qualified commercial request; copy states payment/token activation stay manual. | Done |
| P-011 | 5 | Admin usage ledger UX. | Saint + AI Builder | Admin tidak bisa melihat usage durable setelah metering aktif. | `/g7-admin` shows today units, by-tier/mode aggregates, and recent hashed usage events without raw token/prompt/answer data. | Done |
| P-012 | 5 | Early revenue demo and follow-up kit. | Saint + AI Builder | Commercial gateway siap tapi founder belum punya copy/demo untuk outreach manual. | `ops/revenue/DEMO_AND_FOLLOWUP_TODAY.md` covers Mas Dikun, Custom Style, Cleanforyou, 24/48h follow-up, price, expensive objection, and demo response; prospect tracker has quote/response/follow-up fields. | Done |
| P-008 | 6 | Enterprise/Investor deck content. | Saint + Faturachman | Narasi capital expansion belum siap. | Deck menjelaskan infra, moat, roadmap, unit economics. | Planned |
| P-013 | v0D | Founder Mission Detail UI. | AI Builder | Founder tidak bisa melihat detail mission secara jelas. | Mission detail menampilkan objective/status/criteria, related tasks dengan evidence dan quality_score, outcome summary, related lessons. Founder/internal only. | Done |
| P-014 | v0D | Task Board Intelligence View. | AI Builder | Task sulit discan dan founder sulit melihat status intelligence loop. | Board/table status dengan filter mission/agent/risk, evidence indicator, stuck indicator, dan quality badges. | Candidate |
| P-015 | v0D | Lesson Review Surface. | AI Builder | Founder tidak bisa melihat lesson learned. | Lesson list dengan filter kategori (5 kategori), detail lesson dengan provenance (missionId/taskIds), score/category/createdAt, Redis-only notice. Founder/internal only. | Done |
| P-016 | v0D | Verifier Surface. | AI Builder | Founder tidak tahu patch mana yang verification-nya failed/missing/pending. | Patch Review tab: verifier summary bar (passed/failed/pending/missing counts), per-patch verifier badge (verified/failed/pending/missing), high-risk blocked warning banner, failed verification warning, verification checks detail (name/command/exitCode/passed icon/timestamp), approve button disabled when high-risk blocked or failed. Backend: enriched patch endpoints + dedicated verifications endpoints. `tsc --noEmit` pass. `npx next build` pass. Tests 44/0. | Done |
| P-017 | v0D | Model Arena Surface. | AI Builder | Founder tidak bisa melihat model performance dan runtime signal. | Colony UI punya tab Model Arena berisi scored summaries, advisory recommendations, runtime stats success/fail/latency, recent safe runtime events, Redis-only/no-raw-prompt policy labels. Backend `GET /colony/model-arena` founder-only menggabungkan summaries, runtime events, runtime stats, recommendations. Root typecheck/build PASS; Next build PASS. | Done |

## Product Principle

UI JAGAT harus terasa seperti konsol kerja intelijen: padat, tenang, terstruktur, dan tidak marketing berlebihan.

## Audit Terakhir

Tanggal: 2026-05-20

- Login page sudah dibersihkan dari logo Google dan proxy asing.
- Panel terminal simulator dihapus dari halaman login.
- Panel kanan login diganti menjadi demo animatif produk: Riset, Ingest, Memori, Eksekusi.
- Phase 3A form ingest metadata selesai.
- Phase 3B manifest kurasi dokumen Wave 1 selesai.
- Phase 3C extraction report selesai untuk Wave 1.
- Phase 3D chunk report selesai untuk Wave 1.
- Phase 3E bulk ingest report selesai untuk Wave 1.
- Phase 3F backend contextSources siap untuk citation UI.
- Phase 3G citation rendering selesai untuk bubble jawaban.
- Sisa polish produk berikutnya: memory library view dan ekspansi korpus Wave 2.
