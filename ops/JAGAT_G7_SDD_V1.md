# JAGAT G7 SDD v1

Tanggal: 2026-06-09
Status: Draft baseline
Owner: Faturachman Al Kahfi
Scope: Founder Intelligence Console + Colony Workforce
Mode strategis: Stealth Intelligence Lab

---

## 1. Tujuan Dokumen

System Design Document ini menjelaskan desain sistem JAGAT G7 pada fase internal saat ini.

Dokumen ini menjadi jembatan antara:

- Product Control Master;
- PRD v1;
- SRS v1;
- implementasi kode;
- UI/UX Flow;
- ERD/Data Model;
- backlog teknis berikutnya.

Tujuan utamanya adalah memastikan JAGAT tidak dibangun secara acak. Setiap modul harus punya tempat, fungsi, batas, data, dan hubungan yang jelas.

## 2. Prinsip Desain

JAGAT G7 dirancang sebagai sistem intelijen berdaulat, bukan chatbot biasa.

Prinsip desain:

1. Chat adalah cockpit, bukan seluruh produk.
2. Memory adalah fondasi reasoning.
3. Colony adalah tenaga kerja internal, bukan produk publik.
4. Founder gate wajib untuk aksi berisiko.
5. Evaluation, lesson, verifier, dan model arena membentuk intelligence loop.
6. Public user tidak boleh melihat dapur internal Colony.
7. Server staging dipakai untuk pembangunan saat ini, dengan arah migrasi ke Dell PowerEdge R530.
8. Fitur baru harus punya source-of-truth dokumen.

## 3. Arsitektur Tingkat Tinggi

```text
User / Founder / Internal Operator
        |
        v
Next.js UI / Founder Intelligence Console
        |
        v
Express BFF / Sovereign Core API
        |
        +--> Research & Cognitive Prompt Layer
        +--> Colony Runtime
        +--> Patch / Approval / Verifier
        +--> Evaluation / Lesson / Model Arena
        |
        +--> Redis
        +--> Qdrant
        +--> JSONL Ledger
        +--> Token Registry
        |
        v
Ollama / Local Model / Optional Remote Worker
```

## 4. Lapisan Sistem

| Layer | Nama | Fungsi | Status |
| --- | --- | --- | --- |
| L1 | UI Layer | Chat cockpit, founder console, admin/product views | Aktif |
| L2 | BFF/API Layer | Routing, auth, command handling, orchestration | Aktif |
| L3 | Cognitive Layer | Identity, prompt policy, memory-grounded answer | Aktif |
| L4 | Colony Layer | Mission, task, worker, reviewer, scheduler, reporter | Aktif |
| L5 | Memory Layer | Redis, Qdrant, JSONL, ops markdown | Aktif |
| L6 | Verification Layer | Evaluation, lesson, verifier gate, audit | Aktif |
| L7 | Model Layer | Ollama local, optional remote worker, model arena | Aktif |
| L8 | Downstream Agent Layer | Kiting, Ting, Motherbox boundary | Baseline desain |
| L9 | Commercial Layer | Manual usage, admin token ops, invoice draft | Sekunder/dormant |

## 5. Komponen Utama

### 5.1 Next.js UI

Fungsi:

- menyediakan permukaan chat/cockpit;
- menampilkan founder console;
- menampilkan admin/product views;
- meneruskan request ke backend;
- menjaga route internal sesuai access control.

Batas:

- UI tidak menjadi sumber otoritas keamanan final;
- UI tidak boleh membuka Colony internals ke public user;
- UI harus mengikuti auth/backend gate.

### 5.2 Express BFF

Fungsi:

- menjadi dapur kerja API;
- menerima request dari UI;
- menerapkan auth dan role gate;
- menghubungkan UI dengan research, memory, Colony, verifier, dan model layer;
- menjaga response streaming bila diperlukan.

Batas:

- tidak boleh membuka route internal tanpa guard;
- tidak boleh mengubah port/host/connection string tanpa approval;
- tidak boleh deploy otomatis.

### 5.3 Cognitive Prompt Layer

Fungsi:

- mengunci identitas JAGAT;
- memilih mode jawaban;
- membedakan memory-grounded answer dan deduksi logis;
- menjaga refusal policy;
- mencegah identity drift dan prompt leakage.

### 5.4 Colony Runtime

Fungsi:

- mengelola mission;
- mengelola task;
- menjalankan worker sesuai permission;
- membuat report;
- menjaga state machine;
- membuat patch proposal;
- menyimpan evidence;
- menghubungkan task dengan evaluation dan lesson.

Batas:

- Colony adalah internal workforce;
- Colony bukan produk publik;
- action berisiko tetap founder-gated;
- worker tidak mendapat shell bebas.

### 5.5 Memory Layer

Fungsi:

- Redis menyimpan operational state cepat;
- Qdrant menyimpan curated sovereign memory;
- JSONL menyimpan ledger sederhana;
- ops markdown menjadi source-of-truth manusia dan AI;
- Context Budget Manager memilih fragmen memori berdasarkan score, source priority, trust level, recency, dedupe source-chunk, dan batas karakter sebelum masuk prompt.

Batas:

- model output tidak boleh otomatis masuk Qdrant;
- lesson v1 tetap Redis-only;
- curated ingest harus punya provenance;
- context selector hanya memilih/memotong kandidat, tidak menulis memori baru dan tidak melakukan retrieval eksternal.

### 5.6 Verification Layer

Fungsi:

- evaluation memberi quality score;
- lesson memory menangkap pembelajaran dari mission outcome;
- verifier gate memblokir patch approval bila verification failed;
- audit log menyimpan jejak tindakan penting.

Batas:

- quality score tidak boleh auto-approve;
- verifier command harus whitelist;
- missing/pending verification masih allowed untuk low/medium risk pada baseline v0D;
- high-risk patch wajib punya passed verification sebelum approval/apply.

### 5.7 Model Layer

Fungsi:

- Ollama/local model menjalankan inference lokal;
- remote worker opsional membantu tugas drafting/coding ringan;
- model arena mencatat performa model;
- model router dapat memakai data advisory.

Batas:

- remote worker bukan otak utama;
- remote worker tidak boleh memegang keputusan security, deploy, billing, credential;
- model arena v1 advisory, bukan auto-routing final.

## 6. Infrastruktur

### 6.1 Staging Saat Ini

Server staging/sewa saat ini:

- Ryzen 5 3600;
- RAM 32GB;
- Windows 64-bit;
- IP publik `103.190.0.113`;
- menjalankan dashboard, backend, Redis, Qdrant, Ollama ringan, dan Colony.

Peran:

- rumah sementara;
- tempat build/test;
- tempat demo internal;
- tempat mematangkan intelligence loop.

### 6.2 Target Enterprise

Server target/ori enterprise:

- Dell PowerEdge R530;
- 2x Intel Xeon E5-2680 v4;
- 28 cores / 56 threads;
- RAM 336GB;
- storage besar;
- Linux/Proxmox.

Peran:

- rumah utama enterprise;
- target migrasi;
- tempat Qdrant, Redis, model runner, dan Colony dijalankan lebih kuat;
- kandidat host untuk GPU acceleration.

## 7. Alur Utama Sistem

### 7.1 Alur Research / Chat Cockpit

```text
User prompt
  -> UI
  -> BFF
  -> auth/session check
  -> detect answer mode
  -> retrieve Qdrant context bila relevan
  -> build cognitive prompt
  -> call model
  -> stream response
  -> tampilkan answer dan source context
```

### 7.2 Alur Mission / Task

```text
Founder instruction
  -> create mission
  -> create tasks
  -> assign agent/worker
  -> task status transition
  -> evidence attached
  -> review/done
  -> evaluation hook
  -> complete mission
  -> outcome summary
  -> lesson memory
```

### 7.3 Alur Patch / Verifier

```text
Agent submits patch proposal
  -> patch safety validation
  -> optional verifier run
  -> verification record saved
  -> founder approval request
  -> approveProposal checks verification policy
  -> if failed: block approval for all patch risk levels
  -> if high-risk and missing/pending: block approval
  -> if high-risk and verified: allow approval
  -> if low/medium missing/pending: allow baseline v0D behavior
  -> apply remains founder-controlled
```

### 7.4 Alur Model Arena

```text
Task/model execution
  -> record modelId and taskType
  -> record score/latency/outcome when available
  -> record worker runtime metadata: modelId, taskType, latency, outcome, source, safe errorCode
  -> never store raw prompt, raw output, or private chain-of-thought in arena runtime events
  -> aggregate performance
  -> produce advisory recommendation
  -> no automatic final routing in v1
```

## 8. Security dan Access Boundary

### 8.1 Public Boundary

Public user tidak boleh melihat:

- Colony tasks;
- patch proposal internal;
- decision log;
- worker runtime;
- internal backlog;
- secret/config;
- founder-only command.

### 8.2 Founder/Internal Boundary

Founder/internal access dapat melihat:

- mission;
- task;
- evidence;
- evaluation;
- lesson;
- verification;
- model arena;
- internal reports.

Tetap founder-gated untuk:

- approval berisiko;
- patch apply;
- deploy;
- credential;
- billing;
- security final decision.

### 8.3 Downstream Agent Boundary

Kiting AI, Ting AI, dan G7 Motherbox hanya memakai scope yang telah didefinisikan di `AGENT_BOUNDARY_DESIGN.md`.

Mereka tidak boleh menjadi pintu masuk ke Colony internals.

## 9. Data Store Design Ringkas

| Store | Dipakai Untuk | Catatan |
| --- | --- | --- |
| Redis | mission, task, lesson, verification, arena, runtime state | cepat, operational |
| Qdrant | curated knowledge, chunked docs, semantic retrieval | harus punya provenance |
| JSONL | usage ledger, local event ledger | mudah diaudit |
| Ops Markdown | blueprint, roadmap, decision, risk, logs, docs | source-of-truth manusia |
| Token Registry | session/token/commercial metadata | tidak dibahas detail di SDD v1 |

ERD/Data Model v1 akan memformalkan entitas dan field.

## 10. Failure Modes

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Qdrant context salah | Jawaban tidak relevan | citation, retrieval precision test |
| Redis data kotor | task/lesson bercampur | key namespace, idempotency |
| Verifier missing | patch high-risk lolos tanpa test | T-041 high-risk verifier policy |
| Model lambat | UX lambat | model routing, GPU roadmap |
| UI route bocor | internal terlihat publik | auth middleware + backend gate |
| Server staging bermasalah | kerja terhenti | backup, runbook, migrasi R530 |

## 11. Verification Strategy

Baseline setelah perubahan kode:

- `npm run typecheck`;
- test spesifik modul yang disentuh;
- route/access test bila route berubah;
- frontend build bila UI berubah.

Feedback-loop tests yang harus tetap dijaga:

- `node scripts/colony-feedback-loop-v0a-test.mjs`;
- `node scripts/colony-feedback-loop-v0b-test.mjs`;
- `node scripts/colony-feedback-loop-v0c-test.mjs`.

## 12. Open Design untuk v0D

v0D tidak boleh langsung coding besar sebelum hal berikut dikunci:

1. bagaimana memperluas passed verification dari high-risk ke medium/low bila diperlukan;
2. bagaimana lesson dipakai ulang oleh planner;
3. bagaimana Context Budget Manager dievaluasi terhadap benchmark retrieval precision lintas misi;
4. bagaimana reasoning trace disimpan tanpa membocorkan rahasia;
5. bagaimana UI founder review untuk lesson/verifier/model arena;
6. bagaimana migrasi Redis/Qdrant dari staging ke R530 direncanakan;
7. bagaimana ERD/Data Model memisahkan Redis, Qdrant, JSONL, dan ops docs.

## 13. Definition of Done SDD v1

SDD v1 dianggap cukup untuk lanjut FSD/UI/ERD bila:

- semua layer utama dijelaskan;
- alur chat, mission, patch, verifier, model arena jelas;
- boundary public/internal/downstream jelas;
- staging vs R530 tidak keliru;
- open design v0D tercatat.
