# Colony Intelligence Execution Plan — June 2026

_Created: 2026-06-08_
_Author: Colony Builder (Phase 0 sync)_
_Source of Truth: `ops/COLONY_TO_PROTO_AGI_AUDIT.md`_

---

## 1. Status Saat Ini

**Audit Score: 38/100** — Proto-Colony (Multi-Agent OS), belum Colony Intelligence.

### Komponen yang Sudah Ada (foundation solid):
| Komponen | Skor | Keterangan |
|----------|------|------------|
| Agent boundary & roles | 8/10 | 6 roles, permission matrix |
| Task state machine | 8/10 | Validasi transisi ketat |
| Mission engine | 7/10 | CRUD lengkap, linked to tasks |
| Approval workflow | 7/10 | Founder-gated, audit trail |
| Audit trail | 8/10 | Append-only, actor-indexed |
| Scheduler loop (C6) | 7/10 | Auto-claim, stuck detection |
| Worker sandbox | 8/10 | Role-scoped, path security |
| Patch proposal engine | 7/10 | Submit → approve → apply |
| Model routing (Garuda Ladder) | 6/10 | Advisory by risk/role |
| Cognitive benchmark | 7/10 | 10-area memory test |
| Distillation pool | 6/10 | Screening, founder review |
| Memory (Qdrant RAG) | 7/10 | Hybrid retrieval, citation |

### Komponen yang BELUM Ada (5 critical gaps):
| Komponen | Skor | Dampak |
|----------|------|--------|
| Evaluation layer | 0/10 | Tidak bisa mengukur kualitas output |
| Execution loop (replan) | 0/10 | Setiap kegagalan butuh founder manual |
| Lesson learned / feedback | 0/10 | Colony tidak belajar dari pengalaman |
| Verifier (output quality) | 0/10 | "Done" tidak ada artinya tanpa verifikasi |
| Model arena / A-B testing | 0/10 | Routing tidak berbasis data |

---

## 2. Target: 14 Hari (2026-06-08 → 2026-06-22)

### Phase Order (urutan wajib, sesuai prioritas audit):

| Day | Phase | Task ID | Deliverable | Blocking? |
|-----|-------|---------|-------------|-----------|
| 1-2 | Phase 0 | — | Audit sync, execution plan, backlog lock | Ya (ini) |
| 3-4 | Phase 1 | T-035 | Colony Evaluation Layer v0 | Ya (tanpa ini, semua lain tidak berguna) |
| 5 | Phase 2 | T-036 | Mission Execution Loop v0 | Ya (butuh evaluation) |
| 6-7 | Phase 3 | T-037 | Lesson Memory v0 | Ya (butuh mission outcome) |
| 8-9 | Phase 4 | T-038 | Verifier Gate v0 | Ya (butuh evaluation) |
| 10-11 | Phase 5 | T-039 | Model Arena v0 | Tidak blocker |
| 12-13 | Phase 6 | — | Integration test + report | Ya (final gate) |
| 14 | Phase 7 | — | Readiness report update + founder review | Ya |

---

## 3. Scope v0 — Prinsip Universal

Untuk SEMUA 5 komponen:

### Yang TERMASUK:
- ✅ Engine lokal di `src/colony/`
- ✅ Storage Redis-only (bukan Qdrant sovereign memory)
- ✅ Scoring deterministic (keyword/heuristic, bukan LLM)
- ✅ Smoke test di `scripts/`
- ✅ Barrel export dari `src/colony/index.ts`
- ✅ Type addition di `src/colony/types.ts`
- ✅ Evidence/record tercatat, bisa diaudit

### Yang TIDAK TERMASUK (red lines):
- ❌ Auto-approve task berdasarkan score
- ❌ Auto-retry task yang gagal
- ❌ Auto-route production task ke model tertentu
- ❌ Fine-tuning otomatis
- ❌ LLM call dalam evaluation/scoring
- ❌ Shell execution luas untuk worker
- ❌ Penulisan ke Qdrant sovereign memory
- ❌ Perubahan approval policy
- ❌ Perubahan dependency baru
- ❌ Perubahan `.env`, port, host, connection string
- ❌ Deploy atau restart production service

---

## 4. Red Lines (dari AGENTS.md + DECISION_LOG + RISK_REGISTER)

| Red Line | Sumber | Relevansi |
|----------|--------|-----------|
| Jangan ubah `.env` atau konfigurasi produksi | AGENTS.md | Semua phase |
| Jangan deploy ke production | AGENTS.md | Semua phase |
| Jangan auto-approve | Phase brief | Evaluation, Verifier |
| Jangan beri worker shell execution luas | Phase brief | Verifier |
| Jangan auto-route production | Phase brief | Model Arena |
| Jangan fine-tuning otomatis | Phase brief | Model Arena |
| Jangan tulis lesson ke Qdrant | Phase brief | Lesson Memory |
| Jangan ubah approval policy | Phase brief | Mission Loop |
| D-004: Auto-ingest ke Qdrant dimatikan | DECISION_LOG | Lesson Memory |
| D-015: Final output wajib lewat benchmark | DECISION_LOG | Verifier |
| R-007: Scope creep sebelum memory matang | RISK_REGISTER | Semua phase |
| R-003: Qdrant pollution | RISK_REGISTER | Lesson Memory |

---

## 5. Acceptance Criteria per Phase

### Phase 1 — Evaluation Layer v0 (T-035)
- [ ] `src/colony/evaluation-engine.ts` created
- [ ] Scoring 0-100 berbasis: acceptance criteria, evidence, completeness, risk markers, status consistency
- [ ] Tidak pakai LLM
- [ ] Score tersimpan sebagai evidence task (type `quality_score` atau kompatibel)
- [ ] Export dari `src/colony/index.ts`
- [ ] `tsc --noEmit` pass
- [ ] Test script: `scripts/colony-evaluation-test.mjs` pass

### Phase 2 — Mission Execution Loop v0 (T-036)
- [ ] Mission completed menghasilkan outcome summary
- [ ] Summary berisi: task status counts, quality score aggregate, blocked reasons
- [ ] Tidak auto-replan, auto-retry, atau auto-create task
- [ ] Tidak mengubah approval policy
- [ ] `tsc --noEmit` pass
- [ ] Test script pass

### Phase 3 — Lesson Memory v0 (T-037)
- [ ] `src/colony/lesson-engine.ts` created
- [ ] Lesson dibuat dari mission outcome summary
- [ ] Lesson punya provenance: missionId, taskIds, score, createdAt
- [ ] Storage Redis-only, BUKAN Qdrant
- [ ] Bisa dilist/dibaca
- [ ] Tidak pakai LLM extraction
- [ ] `tsc --noEmit` pass
- [ ] Test script pass

### Phase 4 — Verifier Gate v0 (T-038)
- [ ] Patch punya verification evidence
- [ ] Failed verification tidak bisa dianggap ready
- [ ] Command suggestion aman (typecheck, build, test)
- [ ] Tidak ada shell access luas
- [ ] Tidak auto-run destructive command
- [ ] `tsc --noEmit` pass
- [ ] Test script pass

### Phase 5 — Model Arena v0 (T-039)
- [ ] Bisa membaca/menyimpan performance summary per model per task type
- [ ] Recommendation bersifat advisory
- [ ] Tidak mengubah runtime routing otomatis
- [ ] Tidak ubah model default atau Ollama config
- [ ] `tsc --noEmit` pass
- [ ] Test script pass

### Phase 6 — Integration Report
- [ ] Semua smoke test pass (5 scripts)
- [ ] Readiness report dengan skor maturity baru
- [ ] Gap analysis jujur
- [ ] Tidak ada klaim AGI/Proto-AGI berlebihan

---

## 6. Catatan Penting

### Prioritas Audit (dari `COLONY_TO_PROTO_AGI_AUDIT.md`):
1. **Evaluation Layer** — paling kritis, tanpa ini semua lain tidak berguna
2. **Mission Execution Loop** — membedakan "mesin task" dari "mesin yang bisa berpikir"
3. **Verifier / Output Quality Gate** — memastikan "done" bermakna
4. **Lesson Memory** — membuat Colony belajar dari pengalaman
5. **Model Arena** — optimasi, bukan blocker

### Ketergantungan antar phase:
- Phase 2 (Mission Loop) butuh Phase 1 (Evaluation) untuk aggregate quality scores
- Phase 3 (Lesson Memory) butuh Phase 2 (Mission Loop) untuk outcome summary
- Phase 4 (Verifier) butuh Phase 1 (Evaluation) untuk quality gate
- Phase 5 (Model Arena) independen, tapi lebih berguna setelah Phase 1 punya data

### Implementasi yang Sudah Ada (dari sesi sebelum):
Sesi sebelumnya sudah mengimplementasi kode untuk semua 5 engine ini. Kode sudah ada di `src/colony/` dan sudah pass test. Phase 0 ini adalah **audit sync dan backlog formalisasi**, bukan rewrite.

---

_This document is the execution contract. Do not deviate without founder approval._
