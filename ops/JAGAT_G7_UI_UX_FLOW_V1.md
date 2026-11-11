# JAGAT G7 UI/UX Flow v1

Tanggal: 2026-06-09
Status: Draft baseline
Owner: Faturachman Al Kahfi
Scope: Founder Intelligence Console + Colony Workforce
Mode strategis: Stealth Intelligence Lab

---

## 1. Tujuan Dokumen

Dokumen ini menjelaskan alur layar dan pengalaman pengguna JAGAT G7 pada fase internal.

Tujuannya:

- membuat UI tidak berjalan liar mengikuti fitur yang muncul satu per satu;
- memastikan chat tetap menjadi cockpit, bukan seluruh produk;
- menjaga Colony tetap internal;
- membuat founder bisa melihat misi, task, memory, verifier, lesson, dan model arena secara rapi;
- menjadi dasar backlog UI berikutnya.

## 2. Prinsip UX

JAGAT G7 harus terasa seperti konsol kerja intelijen:

- padat tetapi tidak membingungkan;
- tenang, profesional, dan tidak seperti landing page marketing;
- mudah discan;
- fokus pada pekerjaan, status, bukti, dan keputusan;
- tidak membuka dapur internal ke public user;
- action berisiko harus jelas dan founder-gated.

Prinsip utama:

> Chat adalah pintu komando. Console adalah ruang kendali. Colony adalah mesin kerja di belakang layar.

## 3. Role dan Akses Layar

| Role | Layar Utama | Batas |
| --- | --- | --- |
| Founder | semua internal console | tetap mengikuti red lines untuk deploy/credential/security |
| Internal Operator | dashboard, memory, usage, status, selected admin | tidak apply patch/deploy/security final |
| Public User | downstream agent surface | tidak melihat Colony internals |
| Colony Agent | service/runtime internal | tidak memakai UI publik sebagai akses internal |

## 4. Struktur Navigasi Utama

```text
JAGAT G7 Console
  |
  +-- Cockpit
  |     +-- Chat / Research
  |     +-- Agent Mode Selector
  |     +-- Source Context Panel
  |
  +-- Missions
  |     +-- Mission List
  |     +-- Mission Detail
  |     +-- Outcome Summary
  |
  +-- Tasks
  |     +-- Task Board
  |     +-- Task Detail
  |     +-- Evidence / Evaluation
  |
  +-- Memory
  |     +-- Document Library
  |     +-- Source Detail
  |     +-- Ingest Status
  |
  +-- Intelligence Loop
  |     +-- Lessons
  |     +-- Verifier
  |     +-- Model Arena
  |
  +-- Admin
        +-- Usage
        +-- Tokens
        +-- Manual Requests
        +-- System Health
```

## 5. Layar 1 - Cockpit

### Tujuan

Cockpit adalah layar awal kerja founder/user untuk bertanya, memberi perintah, dan memulai mission.

### Komponen

- chat thread;
- input prompt;
- agent mode selector;
- source context panel;
- response status;
- optional action button untuk "buat mission" atau "simpan sebagai task draft".

### Flow

```text
User membuka Cockpit
  -> memilih mode: Research / Kiting / Ting / Motherbox / Founder
  -> mengetik prompt
  -> sistem mencari memory bila relevan
  -> jawaban tampil
  -> source context tampil jika ada
  -> user dapat lanjut chat atau ubah menjadi mission/task
```

### State

- idle;
- loading/retrieving context;
- streaming answer;
- answer complete;
- no context found;
- refusal;
- error/retry.

### Batas UX

- jangan menampilkan internal prompt;
- jangan menampilkan Colony runtime public;
- jangan membuat user merasa semua jawaban pasti benar tanpa source.

## 6. Layar 2 - Mission List

### Tujuan

Menampilkan daftar mission sebagai pekerjaan tingkat besar.

### Komponen

- filter status;
- search mission;
- mission card/table;
- status badge;
- quality summary;
- blocked indicator;
- create mission button untuk founder/internal.

### Flow

```text
Founder membuka Missions
  -> melihat daftar mission
  -> filter queued/running/blocked/completed
  -> buka mission detail
  -> review task dan outcome
```

### Data yang Ditampilkan

- mission id;
- title/objective;
- status;
- created at/updated at;
- task count;
- done/blocked count;
- average quality score;
- source-of-truth.

## 7. Layar 3 - Mission Detail

### Tujuan

Menjadi ruang kontrol untuk satu mission.

### Komponen

- mission objective;
- acceptance criteria;
- task list;
- progress summary;
- evidence summary;
- outcome summary;
- related lessons;
- action buttons: complete, block, archive, create task.

### Flow

```text
Founder membuka Mission Detail
  -> membaca objective dan acceptance criteria
  -> melihat task terkait
  -> membuka task detail bila perlu
  -> setelah selesai, isi outcome summary
  -> complete mission
  -> lesson dibuat otomatis Redis-only
```

### Batas UX

- complete mission harus memperlihatkan konsekuensi lesson creation;
- blocked mission wajib alasan;
- no auto-replan pada v1.

## 8. Layar 4 - Task Board

### Tujuan

Menampilkan pekerjaan Colony dalam bentuk board atau table yang mudah discan.

### Kolom Status

- queued;
- planning;
- approved;
- running;
- review;
- blocked;
- done;
- archived.

### Komponen

- status columns/table;
- filter agent;
- filter risk;
- filter mission;
- stuck indicator;
- evidence indicator;
- quality score badge.

### Flow

```text
Internal user membuka Task Board
  -> filter task
  -> buka task detail
  -> review evidence
  -> lihat evaluation
  -> ambil action bila role mengizinkan
```

## 9. Layar 5 - Task Detail

### Tujuan

Menampilkan satu task secara lengkap.

### Komponen

- task objective;
- assigned agent;
- status;
- risk level;
- acceptance criteria;
- evidence list;
- quality score;
- blocked reason;
- audit trail;
- related patch/verifier bila ada.

### Action

- move to review;
- mark blocked;
- mark done;
- attach evidence;
- open patch proposal;
- open verification.

### Batas UX

- done tidak tersedia jika evidence kosong;
- blocked wajib alasan;
- action berisiko diberi label jelas.

## 10. Layar 6 - Memory Library

### Tujuan

Menampilkan dokumen dan memori yang menjadi dasar pengetahuan JAGAT.

### Komponen

- document list;
- category filter;
- trust level filter;
- source/provenance;
- chunk count;
- last ingest status;
- search.

### Flow

```text
User membuka Memory
  -> cari dokumen
  -> buka source detail
  -> lihat provenance dan chunk
  -> gunakan sebagai context untuk research
```

### Batas UX

- hanya curated memory yang boleh diposisikan sebagai source-of-truth;
- model output/debug prompt tidak boleh tampil sebagai dokumen resmi.

## 11. Layar 7 - Lessons

### Tujuan

Menampilkan pembelajaran dari mission outcome.

### Komponen

- lesson list;
- category filter;
- related mission;
- quality score;
- blocked pattern;
- created at;
- review status.

### Flow

```text
Founder membuka Lessons
  -> melihat lesson terbaru
  -> filter blocked_pattern / quality_low
  -> buka detail
  -> putuskan apakah lesson perlu memengaruhi planner v0D
```

### Batas UX

- lesson tidak otomatis masuk Qdrant;
- lesson tidak otomatis mengubah roadmap.

## 12. Layar 8 - Verifier

### Tujuan

Menampilkan hasil verification untuk patch proposal. Founder/internal reviewer bisa melihat status verifier per patch, sehingga patch yang failed/missing verification tidak terlihat "aman".

### Komponen

- verifier summary bar (passed/failed/pending/missing counts);
- per-patch verifier status badge (verified=green, failed=red, pending=amber, missing=orange);
- high-risk blocked warning banner (jika high-risk + belum verified);
- failed verification warning;
- verification checks detail (name, command, exit code, passed/failed icon, timestamp);
- proposal id;
- approval block reason.

### Flow

```text
Founder membuka Patch Review tab
  -> melihat verifier summary bar di atas
  -> setiap patch card menampilkan verifier badge
  -> high-risk patch yang belum verified: card merah + warning banner + approve disabled
  -> failed verification: card merah + warning + approve disabled
  -> missing/pending (low/medium): badge orange/amber, approve tetap bisa
  -> klik verification checks detail untuk melihat command dan hasil
  -> filter by verifierStatus (?verifierStatus=failed) untuk cari patch bermasalah
```

### Endpoint

- `GET /patches` — enriched: verifierStatus, verifierChecks, verifierVerifiedAt, highRiskBlocked, verifierCounts, ?verifierStatus= filter
- `GET /patches/:id` — enriched sama
- `GET /verifications` — list all verifications + summary counts
- `GET /verifications/:id` — single verification (returns missing if not found)

### Batas UX

- command arbitrary tidak boleh ditampilkan sebagai opsi;
- missing verification harus terlihat jelas agar tidak disangka passed;
- high-risk patch approve button disabled sampai verification passed;
- failed verification approve button disabled untuk semua risk level.

## 13. Layar 9 - Model Arena

### Tujuan

Menampilkan performa model berdasarkan task type.

### Komponen

- model list;
- task type;
- average score;
- average latency;
- sample count;
- recommendation label;
- last run.

### Flow

```text
Founder membuka Model Arena
  -> pilih task type
  -> bandingkan model
  -> lihat rekomendasi advisory
  -> gunakan untuk keputusan, bukan auto-route final
```

### Batas UX

- rekomendasi harus diberi label advisory;
- tidak boleh memberi kesan model otomatis menjadi otak utama.

## 14. Layar 10 - Admin

### Tujuan

Menampung fungsi internal operasional.

### Sub-layar

- usage ledger;
- token operations;
- manual request intake;
- invoice draft;
- system health.

### Batas UX

- commercial layer saat ini sekunder/dormant;
- tidak ada payment gateway otomatis;
- tidak ada auto token activation dari payment;
- admin action harus role-gated.

## 15. Empty, Error, dan Loading State

Setiap layar harus punya state:

- loading;
- empty;
- error;
- permission denied;
- stale data;
- retry available bila aman.

Contoh:

- Mission kosong: tampilkan opsi create mission untuk founder.
- Memory kosong: tampilkan "belum ada curated memory".
- Verifier missing: tampilkan "belum diverifikasi", bukan "aman".
- Model arena kosong: tampilkan "data belum cukup untuk rekomendasi".

## 16. Prioritas UI Setelah Dokumen Ini

Prioritas UI:

1. Mission detail + outcome summary.
2. Lesson review surface.
3. Verifier status surface.
4. Model Arena surface.
5. Context/source panel di Cockpit.
6. Staging/R530 infrastructure status page.

## 17. Acceptance Criteria

UI/UX Flow v1 cukup bila:

- semua layar inti sudah terdefinisi;
- role dan access boundary jelas;
- flow chat, mission, task, memory, lesson, verifier, model arena jelas;
- commercial surface tidak menjadi prioritas utama;
- open items bisa diturunkan ke backlog.

