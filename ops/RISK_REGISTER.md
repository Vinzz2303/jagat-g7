# JAGAT G7 Risk Register

| ID | Risiko | Severity | Probabilitas | Dampak | Mitigasi | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Identity drift: model mengaku Codex/ChatGPT/OpenAI atau salah pencipta. | Critical | Medium | Merusak identitas dan kepercayaan founder. | Identity fast-path, system prompt, `benchmark:identity`, `test:creator`. | AI Builder | Mitigated |
| R-002 | Prompt leakage: UI menampilkan instruksi internal, threshold, atau rahasia dapur. | Critical | Medium | Membocorkan strategi dan membuat produk terlihat generik. | Cognitive prompt ringkas, no-leak benchmark, filter response. | AI Builder | Mitigated |
| R-003 | Qdrant pollution: output model masuk ke memori sebagai knowledge. | Critical | High | Memori rusak, kesalahan lama berulang. | Auto-ingest dimatikan; source feedback-loop ditolak; benchmark Phase 2C. | AI Builder | Mitigated |
| R-004 | Ingest tanpa metadata/provenance. | High | High | Memori tidak bisa diaudit dan citation lemah. | Phase 3 schema wajib metadata/provenance; Wave 1/2 chunk artifacts punya metadata lengkap; Memory Library UI `/memory` menampilkan dokumen, chunk, trust level, provenance, dan SHA. | Saint + AI Builder | Mitigated |
| R-005 | Latency tinggi pada CPU/local model. | Medium | High | UX lambat, terutama query non-fast-path. | Benchmark latency, model routing, GPU roadmap. | AI Builder + Faturachman | Open |
| R-006 | Port/service mati setelah restart server. | High | Medium | UI/backend tidak bisa dipakai. | `scripts/start-jagat-stack.ps1`, `scripts/ops-health.mjs`, dan `ops/RUNTIME_RUNBOOK.md`; health check PASS 3/3. | AI Builder + Faturachman | Mitigated |
| R-007 | Scope creep sebelum memory layer matang. | High | Medium | Proyek jadi acak dan tidak selesai. | Masterplan, backlog gate, weekly execution loop, decision log lock, C6 autonomy guard, dan founder-only runtime controls. Coding berat tetap founder/Codex-gated. | Faturachman + AI Builder | Mitigated |
| R-008 | UI terlalu teknis untuk klien/presentasi. | Medium | Medium | Produk sulit dipahami calon pengguna. | Login front page dipoles menjadi demo produk animatif; perlu review visual lanjutan saat Phase 3 UI metadata/citation dibuat. | Saint + AI Builder | Mitigated |

## Severity

- Critical: merusak identitas, memori, keamanan, atau operasional inti.
- High: menghambat fase utama atau mengganggu demo serius.
- Medium: mengurangi kualitas UX, stabilitas, atau efisiensi.
- Low: polish minor.
