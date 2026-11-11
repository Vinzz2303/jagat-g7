# JAGAT G7 ERD / Data Model v1

Tanggal: 2026-06-09
Status: Draft baseline
Owner: Faturachman Al Kahfi
Scope: Founder Intelligence Console + Colony Workforce
Mode strategis: Stealth Intelligence Lab

---

## 1. Tujuan Dokumen

Dokumen ini memetakan entitas data utama JAGAT G7.

Tujuannya:

- membuat Redis, Qdrant, JSONL, ops markdown, dan token registry tidak bercampur tanpa struktur;
- menjelaskan data apa yang disimpan di mana;
- mencegah lesson dan output model mencemari sovereign memory;
- menjadi dasar backlog teknis dan UI.

## 2. Prinsip Data

1. Qdrant hanya untuk curated sovereign memory.
2. Redis untuk operational state cepat.
3. JSONL untuk ledger sederhana dan audit yang mudah dibaca.
4. Ops markdown adalah source-of-truth manusia dan AI.
5. Token registry hanya menyimpan metadata access/session/commercial, bukan raw prompt rahasia.
6. Data public tidak boleh melihat Colony internals.
7. Lesson v1 tetap Redis-only.

## 3. Data Store

| Store | Fungsi | Contoh Data |
| --- | --- | --- |
| Redis | operational runtime | mission, task, lesson, verification, arena |
| Qdrant | semantic memory | curated chunks, embeddings, metadata |
| JSONL | durable append ledger | usage events, commercial requests |
| Ops Markdown | dokumen resmi | PRD, SRS, SDD, FSD, decision, risk |
| Token Registry | access metadata | token hash, tier, quota, expiry |

## 4. ERD Ringkas

```text
User/Session
  -> Mission
      -> Task
          -> Evidence
          -> Evaluation
          -> PatchProposal
              -> Verification
      -> MissionOutcome
          -> Lesson

MemoryDocument
  -> MemoryChunk
      -> RetrievalContext

Model
  -> ModelArenaResult
      -> ModelArenaSummary

CommercialRequest
  -> InvoiceDraft
  -> UsageEvent

AuditEvent links to Mission/Task/Patch/Verification/AdminAction
```

## 5. Entitas: User / Session

Store: Token Registry / session layer.

Field minimal:

| Field | Fungsi |
| --- | --- |
| userId/sessionId | identitas sesi |
| role/tier | founder, internal, public, downstream |
| tokenHash | hash token, bukan raw token |
| expiry | masa berlaku |
| quota | batas pemakaian bila relevan |
| status | active/suspended/expired |

Batas:

- raw token tidak disimpan di ledger;
- public session tidak boleh membuka Colony internals.

## 6. Entitas: Mission

Store: Redis.

Field minimal:

| Field | Fungsi |
| --- | --- |
| missionId | id unik |
| title/objective | tujuan mission |
| status | queued/planning/running/blocked/completed/archived |
| sourceOfTruth | dokumen/arah founder |
| acceptanceCriteria | syarat selesai |
| createdAt/updatedAt | waktu |
| createdBy | founder/internal/system |
| outcomeId | link ke outcome bila completed |

Relasi:

- Mission memiliki banyak Task.
- Mission memiliki satu MissionOutcome.
- MissionOutcome dapat menghasilkan Lesson.

## 7. Entitas: Task

Store: Redis.

Field minimal:

| Field | Fungsi |
| --- | --- |
| taskId | id unik |
| missionId | parent mission |
| title/objective | pekerjaan |
| status | queued/planning/approved/running/review/blocked/done/archived |
| assignedAgent | Colony unit |
| riskLevel | low/medium/high/founder-gated |
| acceptanceCriteria | syarat selesai |
| blockedReason | wajib bila blocked |
| createdAt/updatedAt | waktu |

Relasi:

- Task memiliki banyak Evidence.
- Task dapat memiliki Evaluation.
- Task dapat terkait PatchProposal.

## 8. Entitas: Evidence

Store: Redis, attached ke Task.

Field minimal:

| Field | Fungsi |
| --- | --- |
| evidenceId | id unik |
| taskId | parent task |
| type | output, note, test_result, quality_score, link |
| content | isi ringkas |
| metadata | data tambahan |
| createdAt | waktu |
| createdBy | worker/reviewer/system |

Batas:

- evidence bukan source-of-truth Qdrant otomatis;
- evidence sensitif tidak boleh ditampilkan ke public.

## 9. Entitas: Evaluation

Store: Redis/evidence metadata.

Field minimal:

| Field | Fungsi |
| --- | --- |
| evaluationId | id unik |
| taskId | task yang dinilai |
| score | 0-100 |
| verdict | high/medium/low atau pass/warn/fail |
| dimensions | breakdown penilaian |
| createdAt | waktu |

Batas:

- score advisory;
- tidak auto-approve.

## 10. Entitas: MissionOutcome

Store: Redis.

Field minimal:

| Field | Fungsi |
| --- | --- |
| outcomeId | id unik |
| missionId | parent mission |
| summary | ringkasan hasil |
| taskCounts | done/blocked/running |
| avgQualityScore | rata-rata kualitas |
| blockedReasons | alasan blocked |
| completedAt | waktu selesai |

Relasi:

- MissionOutcome menghasilkan Lesson.

## 11. Entitas: Lesson

Store: Redis-only v1.

Field minimal:

| Field | Fungsi |
| --- | --- |
| lessonId | id unik |
| missionId | asal mission |
| taskIds | task terkait |
| category | quality_high/quality_low/blocked_pattern/scope_change/general |
| summary | pembelajaran |
| score | skor terkait bila ada |
| createdAt | waktu |
| provenance | asal lesson |

Batas:

- tidak otomatis masuk Qdrant;
- idempotent per mission;
- tidak otomatis mengubah roadmap.

## 12. Entitas: PatchProposal

Store: Redis.

Field minimal:

| Field | Fungsi |
| --- | --- |
| proposalId | id unik |
| taskId | task asal |
| authorAgent | pembuat |
| status | draft/review/approved/rejected/applied |
| filesTouched | daftar file |
| riskLevel | risiko |
| validationResult | hasil safety checks |
| createdAt/updatedAt | waktu |

Relasi:

- PatchProposal memiliki Verification.

## 13. Entitas: Verification

Store: Redis.

Field minimal:

| Field | Fungsi |
| --- | --- |
| verificationId | id unik |
| proposalId | patch proposal |
| status | pending/passed/failed |
| checks | daftar command/result |
| failedChecks | nama check gagal |
| createdAt/updatedAt | waktu |

Batas:

- command harus whitelist;
- failed verification memblokir approval;
- missing/pending masih allowed baseline v1.

## 14. Entitas: MemoryDocument

Store: Ops Markdown + Qdrant metadata.

Field minimal:

| Field | Fungsi |
| --- | --- |
| documentId | id dokumen |
| title | judul |
| source | path/sumber |
| category | roadmap/blueprint/risk/backlog/dll |
| docType | md/pdf/xlsx/txt |
| owner | pemilik |
| createdAt | tanggal |
| trustLevel | tingkat kepercayaan |
| provenance | asal dokumen |
| sha256 | fingerprint |

Relasi:

- MemoryDocument memiliki banyak MemoryChunk.

## 15. Entitas: MemoryChunk

Store: Qdrant.

Field minimal:

| Field | Fungsi |
| --- | --- |
| chunkId | id chunk |
| documentId | parent dokumen |
| chunkIndex | urutan |
| chunkTotal | total chunk |
| content | teks chunk |
| embedding | vector |
| metadata | title/source/category/trust/provenance |

Batas:

- hanya curated data;
- tidak boleh prompt leak/debug/model output.

## 16. Entitas: RetrievalContext

Store: runtime response/log bila diperlukan.

Field minimal:

| Field | Fungsi |
| --- | --- |
| queryId | id query |
| chunkIds | chunk yang dipakai |
| scores | score retrieval |
| answerMode | research/technical/executive/general |
| createdAt | waktu |

## 17. Entitas: ModelArenaResult

Store: Redis.

Field minimal:

| Field | Fungsi |
| --- | --- |
| resultId | id unik |
| modelId | model yang dipakai |
| taskType | jenis tugas |
| score | hasil kualitas |
| latencyMs | waktu |
| outcome | success/fail/partial |
| createdAt | waktu |

Relasi:

- Banyak result membentuk ModelArenaSummary.

## 18. Entitas: UsageEvent

Store: JSONL.

Field minimal:

| Field | Fungsi |
| --- | --- |
| eventId | id |
| tokenHash | hash token |
| tier | paket/tier |
| agentMode | mode agent |
| units | unit pemakaian |
| status | allowed/blocked/error |
| latencyMs | waktu |
| createdAt | waktu |

Batas:

- tidak menyimpan raw prompt;
- tidak menyimpan raw answer;
- tidak menyimpan raw token.

## 19. Entitas: CommercialRequest

Store: JSONL.

Field minimal:

| Field | Fungsi |
| --- | --- |
| requestId | id |
| name/contact | kontak request |
| status | new/qualified/quoted/closed_won/closed_lost |
| requestedPackage | paket yang diminta |
| notes | catatan aman |
| createdAt/updatedAt | waktu |

Batas:

- tidak ada payment gateway otomatis;
- invoice draft bukan payment confirmation.

## 20. Entitas: AuditEvent

Store: Redis/JSONL/ops log sesuai kebutuhan.

Field minimal:

| Field | Fungsi |
| --- | --- |
| eventId | id |
| actor | founder/internal/agent/system |
| action | aksi |
| targetType | mission/task/patch/verifier/admin |
| targetId | id target |
| result | success/blocked/error |
| createdAt | waktu |
| notes | catatan |

## 21. Data Boundary

| Data | Public | Internal | Founder |
| --- | --- | --- | --- |
| Public chat answer | boleh | boleh | boleh |
| Colony task | tidak | terbatas | boleh |
| Patch proposal | tidak | terbatas | boleh |
| Decision log | tidak | terbatas | boleh |
| Qdrant curated docs | tergantung mode | boleh | boleh |
| Lesson memory | tidak | boleh | boleh |
| Verification result | tidak | boleh | boleh |
| Usage aggregate | tidak | boleh | boleh |
| Credential/secret | tidak | tidak | manual only |

## 22. Open Items untuk v2

- schema final bila Redis diganti/ditambah database relasional;
- retention policy usage/commercial JSONL;
- lesson review status field;
- model arena confidence score;
- context budget trace;
- migration mapping dari staging Ryzen ke Dell R530;
- tenant boundary untuk downstream public agents.

## 23. Acceptance Criteria

ERD/Data Model v1 cukup bila:

- entitas inti sudah terpetakan;
- store tiap entitas jelas;
- boundary public/internal/founder jelas;
- Redis/Qdrant/JSONL tidak bercampur fungsi;
- backlog bisa diturunkan dari gap data model.

