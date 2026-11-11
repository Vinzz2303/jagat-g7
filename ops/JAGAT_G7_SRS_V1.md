# JAGAT G7 SRS v1

Tanggal: 2026-06-09
Status: Draft baseline
Scope: Founder Intelligence Console + Colony Workforce

---

## 1. Tujuan

Software Requirements Specification ini mendefinisikan requirement fungsional dan non-fungsional untuk produk internal JAGAT G7 saat ini. Dokumen ini menerjemahkan Product Control Master dan PRD v1 menjadi requirement sistem.

## 2. Scope Sistem

Termasuk:

- Conversational cockpit.
- Secure research dan memory-grounded answers.
- Colony mission/task execution.
- Evaluation evidence.
- Mission outcome dan lesson memory.
- Patch verifier soft gate.
- Model arena advisory records.
- Admin/founder console.

Tidak termasuk:

- Payment gateway.
- Public SaaS self-serve.
- Auto-deploy.
- Auto fine-tuning.
- Unrestricted shell.
- Public access ke Colony internals.

## 3. Aktor

| Aktor | Deskripsi |
| --- | --- |
| Founder | Otoritas tertinggi, dapat memberi mission dan menyetujui aksi berisiko |
| Internal Operator | Menggunakan admin console untuk inspeksi dan operasi |
| Colony Agent | AI worker internal yang bekerja sesuai policy |
| Public User | User eksternal, tidak boleh mengakses Colony internals |
| Downstream Agent | Kiting, Ting, Motherbox sebagai product-facing agents |

## 4. Functional Requirements

### FR-001: Conversational Cockpit

Sistem harus menyediakan interface seperti chat untuk command founder/user, research question, dan mission intake.

Sistem tidak boleh memperlakukan chat sebagai seluruh identitas produk.

### FR-002: Memory-Grounded Research

Sistem harus mengambil curated memory yang relevan dari Qdrant untuk research dan internal reasoning.

Sistem harus menampilkan atau menyimpan source context bila tersedia.

Sistem harus menolak prompt/debug/model-output pollution dari formal ingest.

### FR-003: Mission Management

Sistem harus mendukung create, list, dan complete mission.

Sistem harus memasang outcome summary saat mission diselesaikan melalui formal completion path.

Sistem tidak boleh melakukan auto-replan atau auto-retry dari mission completion pada v1.

### FR-004: Task Management

Sistem harus mendukung status task:

- queued
- planning
- approved
- running
- review
- blocked
- done
- archived

Sistem harus memaksa valid state transition.

Sistem harus mewajibkan blocked reason untuk blocked task.

Sistem harus mewajibkan evidence sebelum task menjadi done.

### FR-005: Task Evidence

Sistem harus menyimpan evidence pada task.

Evidence dapat memiliki quality metadata:

- quality_score
- quality_verdict
- quality_dimensions

### FR-006: Evaluation Hook

Saat task masuk review atau done, sistem harus memasang quality_score evidence jika belum ada.

Sistem harus mencegah duplicate quality_score evidence untuk task yang sama.

Sistem tidak boleh melakukan auto-approve berdasarkan quality score.

### FR-007: Mission Outcome ke Lesson Memory

Saat mission completed dengan outcome summary, sistem harus membuat lesson dari mission outcome.

Lesson harus idempotent per mission.

Lesson harus Redis-only pada v1.

Lesson tidak boleh ditulis ke sovereign Qdrant memory.

### FR-008: Lesson Classification

Sistem harus mengklasifikasikan lesson menjadi:

- quality_high
- quality_low
- blocked_pattern
- scope_change
- general

Sistem harus memprioritaskan blocked_pattern di atas quality_low ketika blockedCount >= 2.

### FR-009: Patch Proposal Lifecycle

Sistem harus mengizinkan agent yang punya permission untuk submit patch proposal.

Sistem harus memvalidasi patch hunks terhadap path dan content safety checks.

Sistem harus mengizinkan approval melalui founder/command layer lewat approveProposal.

Sistem harus menjaga applyPatch tetap founder-only dan tidak diekspor melalui general index barrel.

### FR-010: Verifier Gate

Sistem harus mencatat verification checks untuk patch proposals.

Allowed verifier commands pada v1:

- npm run typecheck
- npm run build
- npm test

Sistem harus menolak verifier command di luar whitelist.

Sistem harus memblokir patch approval ketika verification record ada dan statusnya failed.

Sistem masih mengizinkan missing atau pending verification pada baseline v0C/v1 sampai founder mengunci policy yang lebih ketat.

### FR-011: Model Arena

Sistem harus mencatat performa model berdasarkan modelId dan taskType.

Sistem harus menyediakan rekomendasi advisory.

Sistem tidak boleh melakukan auto-route production tasks berdasarkan arena result pada v1.

### FR-012: Access Control

Sistem harus menjaga internal Colony surfaces tetap terlindungi.

Public users tidak boleh mengakses Colony tasks, approvals, decision logs, atau worker runtime.

Founder/internal routes harus role-gated.

### FR-013: Audit Logging

Sistem harus mencatat task, patch, approval, dan scheduler actions yang kritikal untuk review berikutnya.

## 5. Non-Functional Requirements

### NFR-001: Safety

Sistem harus mengutamakan founder-gated approval untuk aksi berisiko tinggi.

Sistem tidak boleh deploy ke production secara otomatis.

Sistem tidak boleh mengubah `.env`, port, host, connection string, atau production config secara otomatis.

### NFR-002: Security

Sistem harus mencegah prompt leakage dan identity drift.

Sistem harus menolak duplicate identity headers.

Sistem harus melindungi internal Colony routes dari public access.

### NFR-003: Reliability

Sistem harus lulus typecheck setelah perubahan kode.

Sistem sebaiknya menjaga operational state melalui Redis/Qdrant persistence sesuai kebutuhan.

### NFR-004: Observability

Sistem harus menyediakan log, summary, dan evidence yang cukup untuk founder review.

Sistem sebaiknya menyediakan visibility untuk task quality, mission outcome, lesson, verifier, dan model arena.

### NFR-005: Performance

Sistem sebaiknya menjaga evaluation deterministic dan local pada v1.

Sistem sebaiknya menghindari LLM call untuk basic scoring dan lesson creation pada v1.

### NFR-006: Maintainability

Feature baru harus dipetakan ke PRD/SRS/FSD/SDD atau explicit founder instruction.

Module baru harus memperbarui `src/colony/index.ts` bila memang dimaksudkan dipakai melalui colony barrel.

## 6. Data Storage Requirements

| Store | Penggunaan Saat Ini |
| --- | --- |
| Redis | tasks, missions, lessons, approvals, verification, arena data |
| Qdrant | curated sovereign memory chunks |
| JSONL | usage ledger dan selected local ledgers |
| Ops markdown | source-of-truth docs, roadmap, logs, decisions |
| Token registry | token/session/commercial access metadata |

## 7. Verification Requirements

Baseline commands:

- `npm run typecheck`
- relevant script tests untuk component yang disentuh
- public route verification bila route surface berubah
- frontend build bila UI berubah

Current feedback-loop tests:

- `node scripts/colony-feedback-loop-v0a-test.mjs`
- `node scripts/colony-feedback-loop-v0b-test.mjs`
- `node scripts/colony-feedback-loop-v0c-test.mjs`

## 8. Open Requirements

Akan didefinisikan di SDD/FSD/UI/ERD berikutnya:

- Context Budget Manager.
- Reasoning Trace.
- Mission Planner v1.
- Model Arena runtime data collection.
- Lesson retrieval into planner.
- UI flow untuk founder review atas lesson dan verification.
- Formal entity model untuk Redis/Qdrant/JSONL stores.
