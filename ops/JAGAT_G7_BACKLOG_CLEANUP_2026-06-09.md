# JAGAT G7 Backlog Cleanup - 2026-06-09

Tanggal: 2026-06-09
Status: Baseline cleanup setelah Product Control, PRD, SRS, SDD, FSD, UI/UX Flow, ERD
Owner: Faturachman Al Kahfi
Mode strategis: Stealth Intelligence Lab

---

## 1. Tujuan

Dokumen ini merapikan arah backlog setelah dokumen produk formal dibuat.

Tujuannya:

- memisahkan pekerjaan yang sudah selesai dari pekerjaan berikutnya;
- menahan fitur yang belum punya pagar;
- menurunkan dokumen baru menjadi task yang jelas;
- menjaga fokus sebelum v0D coding besar.

## 2. Dokumen Kontrol yang Sudah Ada

| Dokumen | Status | Fungsi |
| --- | --- | --- |
| Product Control Master | Done | pagar produk utama |
| PRD v1 | Done | kenapa dan untuk siapa produk dibuat |
| SRS v1 | Done | requirement sistem |
| SDD v1 | Done | desain sistem |
| FSD v1 | Done | perilaku fitur |
| UI/UX Flow v1 | Done | alur layar |
| ERD/Data Model v1 | Done | peta entitas dan store |
| Infra Brief Pak Haero | Done | narasi infrastruktur mudah dipahami |

## 3. Status Backlog Lama

### Technical Backlog

T-001 sampai T-039 mayoritas sudah Done.

Area yang sudah kuat:

- identity lock;
- cognitive protocol;
- memory ingestion;
- citation;
- Colony access hardening;
- scheduler;
- distillation;
- remote worker opt-in;
- usage ledger;
- evaluation;
- mission outcome;
- lesson memory;
- verifier gate;
- model arena.

Catatan:

Backlog teknis lama tetap menjadi arsip eksekusi. Jangan dihapus.

### Product Backlog

P-001 sampai P-012 mayoritas Done.

Area yang sudah kuat:

- login/front page polish;
- ingest metadata;
- memory library;
- citation;
- agent mode selector;
- usage/tokens/admin;
- manual commercial gateway;
- early demo kit.

P-008 Enterprise/Investor deck masih Planned, tetapi bukan prioritas harian karena mode sekarang Stealth Intelligence Lab.

## 4. Prioritas Baru Berdasarkan Dokumen Formal

Prioritas sekarang bukan tambah fitur publik.

Prioritas sekarang:

1. membuat intelligence loop bisa dilihat jelas di UI;
2. memperkuat feedback loop internal secara aman;
3. menyiapkan migrasi infra staging -> R530 secara dokumen;
4. meningkatkan retrieval/context discipline;
5. menjaga backlog tetap berdasarkan PRD/SRS/SDD/FSD/UI/ERD.

## 5. New Technical Backlog Candidate

| ID | Source | Task | Risiko | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- |
| T-040 | SDD/FSD | Lesson retrieval into planner v0D | Planner mengulang kesalahan lama | Planner mengambil lesson relevan dari Redis only sebagai advisory context; founder-visible evidence tersedia lewat `GET /planner/lesson-context`; no auto-replan/retry/task/Qdrant write; smoke test pass 12/12 | Done |
| T-041 | SDD/FSD | High-risk verifier policy v0D | Patch high-risk lolos tanpa passed verification | High-risk patch wajib `verified` sebelum approval/apply; failed verification tetap blocked untuk semua patch; missing/pending hanya blocked untuk high-risk; smoke test pass 8/8 + regression verifier/patch pass | Done |
| T-042 | SDD | Context Budget Manager v0 | Retrieval terlalu banyak/noisy | Shared context selector memilih dokumen berdasarkan source priority, recency, trust, score, dedupe source-chunk, dan char/token budget; terpasang di `memory-reader` dan `research`; smoke test pass 9/9 | Done |
| T-043 | SDD/FSD | Model Arena runtime collection | Arena manual dan datanya miskin | Worker runtime mencatat safe metadata: modelId, taskType, latency, outcome, source, errorCode aman, no raw prompt/output; model router tetap advisory-only; smoke test 44/0 | Done |
| T-044 | ERD | AuditEvent normalization | Log tersebar sulit diaudit | Format audit event konsisten untuk mission/task/patch/verifier/admin | Candidate |
| T-045 | Infra Brief/SDD | Staging to R530 migration plan | Migrasi kehilangan data/service | Dokumen runbook migrasi Redis/Qdrant/Ollama/UI/backend dari Ryzen staging ke R530 | Candidate |
| T-046 | UI/UX | Verifier status API/UI support | Founder tidak melihat failed/missing verification | Backend: `GET /patches` enriched dengan verifierStatus/verifierChecks/highRiskBlocked/verifierCounts + `?verifierStatus=` filter. `GET /verifications` + `GET /verifications/:id` endpoints. Frontend: verifier summary bar, per-patch badges (verified/failed/pending/missing), high-risk blocked warning, verification checks detail, approve button disabled on blocked/failed. `tsc --noEmit` pass. `npx next build` pass. Tests 44/0. | Done |
| T-047 | UI/UX | Lesson review API/UI support | Lesson ada tapi tidak bisa direview mudah | list/filter/detail lesson surface tersedia untuk founder/internal | Candidate |
| T-048 | ERD | Usage/commercial retention policy | JSONL tumbuh tanpa kebijakan | Retention/archive policy ditulis, tanpa menghapus data tanpa approval | Candidate |
| T-049 | SDD | Reasoning trace safe design | Trace bisa bocor prompt rahasia | Desain trace hanya menyimpan summary/source ids, bukan chain-of-thought/private prompt | Candidate |

## 6. New Product Backlog Candidate

| ID | Source | Task | Risiko | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- |
| P-013 | UI/UX | Founder Mission Detail UI | Mission outcome tidak terlihat jelas | Mission detail menampilkan objective, criteria, tasks, quality, outcome, related lessons | Candidate |
| P-014 | UI/UX | Task Board Intelligence View | Task sulit discan | Board/table status dengan filter mission/agent/risk dan quality badges | Candidate |
| P-015 | UI/UX | Lesson Review Surface | Lesson tersembunyi di Redis | UI list/filter/detail lessons dengan category dan mission provenance | Candidate |
| P-016 | UI/UX | Verifier Surface | Founder tidak tahu patch mana failed | Patch Review tab: verifier summary bar, per-patch verifier badges (verified/failed/pending/missing), high-risk blocked warning, failed verification warning, verification checks detail, approve button disabled on blocked/failed. Backend: enriched patch endpoints + dedicated verifications endpoints. `tsc --noEmit` pass. `npx next build` pass. Tests 44/0. | Done |
| P-017 | UI/UX | Model Arena Surface | Model recommendation tidak terlihat | UI model/taskType summary dengan score, latency, sample count, advisory label, runtime success/fail stats, recent safe runtime events, dan no raw prompt/output policy label | Done |
| P-018 | UI/UX | Cockpit Source Context Panel polish | Jawaban terlihat seperti chat biasa | Source panel lebih jelas: title/source/category/trust/chunk score | Candidate |
| P-019 | Infra Brief | Infrastructure Status Page | Staging/R530 posisi sering salah dipahami | UI/doc view membedakan server staging Ryzen, target R530, Server B worker | Candidate |
| P-020 | Product Control | Internal Demo Script v1 | Demo internal tidak menunjukkan intelligence loop | Script demo: prompt -> mission -> task -> evidence -> evaluation -> lesson -> verifier/model arena | Candidate |

## 7. Pekerjaan yang Ditahan

Jangan diprioritaskan sekarang:

- payment gateway;
- public SaaS self-serve;
- auto token activation;
- auto fine-tuning;
- unrestricted worker shell;
- public AGI/super intelligence claim;
- large architecture refactor;
- deploy production;
- automatic outbound WhatsApp/email.

## 8. Rekomendasi Urutan v0D

Urutan paling aman:

1. P-013 Mission Detail UI. **Done**
2. P-015 Lesson Review Surface. **Done**
3. T-040 Lesson retrieval into planner v0D. **Done**
4. T-041 High-risk verifier policy. **Done**
5. T-042 Context Budget Manager. **Done**
6. P-016 Verifier Surface. **Done**
7. T-043 Model Arena runtime collection. **Done**
8. P-017 Model Arena Surface. **Done**
9. T-045 Staging to R530 migration plan.

Alasan:

- mission dan lesson adalah inti "belajar";
- verifier menjaga keamanan;
- context budget meningkatkan kualitas reasoning;
- model arena membuat pemilihan model berbasis bukti;
- migrasi R530 disiapkan tanpa mengganggu build saat ini.

## 9. Decision yang Perlu Founder Kunci

Sebelum v0D coding besar, founder perlu mengunci:

1. Apakah low/medium patch juga akan diwajibkan passed verification setelah v0D stabil?
2. Lesson kategori apa yang boleh memengaruhi planner?
3. Apakah planner boleh otomatis menyarankan task dari lesson, atau hanya advisory?
4. Apakah reasoning trace cukup menyimpan source ids + summary, tanpa detail proses berpikir?
5. Apakah migrasi R530 dimulai sebagai dokumen runbook dulu, bukan eksekusi?

Default v0D yang sudah diimplementasi untuk T-040:

- Semua kategori lesson boleh dipertimbangkan planner jika relevansi skornya cukup.
- Lesson bersifat advisory-only.
- Planner tidak boleh auto-replan, auto-retry, membuat task otomatis, atau menulis lesson ke Qdrant.

Default v0D yang sudah diimplementasi untuk T-041:

- Patch `estimatedRisk=high` wajib punya verification `verified` sebelum approval/apply.
- Verification `failed` memblokir semua patch.
- Verification `missing` atau `pending` masih boleh untuk low/medium risk sampai policy berikutnya dikunci.

## 10. Acceptance Criteria Backlog Cleanup

Backlog cleanup ini cukup bila:

- task baru punya source dokumen;
- fitur publik tidak naik prioritas tanpa alasan;
- v0D punya urutan jelas;
- server staging vs R530 tidak keliru;
- backlog lama tetap aman sebagai arsip.
