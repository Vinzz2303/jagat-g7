# JAGAT G7 FSD v1

Tanggal: 2026-06-09
Status: Draft baseline
Owner: Faturachman Al Kahfi
Scope: Founder Intelligence Console + Colony Workforce
Mode strategis: Stealth Intelligence Lab

---

## 1. Tujuan Dokumen

Functional Specification Document ini menjelaskan perilaku fitur JAGAT G7 pada fase internal saat ini.

PRD menjawab "kenapa produk ini dibangun".
SRS menjawab "apa requirement sistem".
SDD menjawab "bagaimana sistem disusun".
FSD ini menjawab "fitur harus berperilaku seperti apa".

Dokumen ini menjadi pegangan sebelum membuat UI/UX Flow, ERD/Data Model, dan backlog cleanup.

## 2. Scope Fitur v1

Termasuk:

- conversational cockpit;
- memory-grounded research;
- founder/internal console;
- mission management;
- task management;
- evidence dan evaluation;
- lesson memory;
- patch proposal;
- verifier gate;
- model arena;
- downstream agent boundary;
- audit/logging visibility.

Tidak termasuk:

- public SaaS self-serve;
- payment gateway;
- automatic payment-to-token activation;
- unrestricted autonomous shell;
- auto-deploy;
- auto fine-tuning;
- klaim AGI publik.

## 3. Aktor dan Hak Fitur

| Aktor | Boleh Melakukan | Tidak Boleh Melakukan |
| --- | --- | --- |
| Founder | create mission, approve, review, inspect internal state | tidak ada bypass terhadap red lines tanpa keputusan eksplisit |
| Internal Operator | inspect status, memory, usage, admin flow terbatas | apply patch, deploy, credential final decision |
| Colony Agent | propose task/patch, attach evidence, execute scoped work | akses publik, credential, deploy, billing, shell bebas |
| Public User | memakai downstream product surface yang aman | akses Colony internals |
| Downstream Agent | bekerja sesuai domain Kiting/Ting/Motherbox | membuka dapur internal JAGAT |

## 4. Fitur 1 - Conversational Cockpit

### Tujuan

Memberikan interface chat yang familiar untuk bertanya, memberi perintah, dan memulai mission.

### Perilaku

1. User memasukkan prompt.
2. Sistem membaca session/role.
3. Sistem menentukan mode jawaban.
4. Jika prompt butuh konteks, sistem mengambil dokumen dari memory.
5. Sistem menjawab dengan identitas JAGAT.
6. Jika konteks tersedia, jawaban mengutamakan konteks.
7. Jika konteks tidak tersedia, sistem menyatakan keterbatasan dan boleh berdeduksi secara jelas.

### Output

- jawaban chat;
- source/citation bila tersedia;
- refusal bila prompt melanggar boundary;
- optional next action bila prompt bisa menjadi mission/task.

### Batas

- chat tidak boleh menjadi pintu ke internal Colony untuk public user;
- chat tidak boleh membocorkan prompt/system policy internal;
- chat tidak boleh mengklaim AGI/super intelligence tanpa benchmark evidence.

## 5. Fitur 2 - Memory-Grounded Research

### Tujuan

Membuat jawaban JAGAT berbasis dokumen resmi, bukan ingatan model mentah.

### Perilaku

1. Sistem menerima topik/pertanyaan.
2. Sistem mencari context relevan dari Qdrant.
3. Sistem memprioritaskan dokumen resmi:
   - Product Control Master;
   - PRD/SRS/SDD/FSD;
   - Execution Masterplan;
   - Decision Log;
   - Risk Register;
   - Technical/Product Backlog;
   - Colony logs.
4. Sistem menyusun jawaban dengan pemisahan antara konteks dan deduksi.
5. Sistem menolak mengarang sumber.

### Output

- jawaban research;
- daftar source context bila tersedia;
- pernyataan keterbatasan bila data tidak cukup.

### Batas

- output model tidak otomatis diingest ke Qdrant;
- data tanpa provenance tidak boleh menjadi source-of-truth.

## 6. Fitur 3 - Mission Management

### Tujuan

Mengubah arahan founder menjadi pekerjaan yang bisa dilacak.

### Perilaku

1. Founder atau internal flow membuat mission.
2. Mission memiliki objective, status, source-of-truth, dan acceptance criteria.
3. Mission dapat dipecah menjadi task.
4. Mission dapat diselesaikan dengan outcome summary.
5. Completion formal memicu lesson memory.

### Status Mission

Minimal:

- queued;
- planning;
- running;
- blocked;
- completed;
- archived.

### Output

- mission record;
- task list;
- outcome summary;
- lesson candidate.

### Batas

- v1 tidak melakukan auto-replan;
- v1 tidak melakukan auto-retry;
- mission completion tidak otomatis menulis ke Qdrant.

## 7. Fitur 4 - Task Management

### Tujuan

Menjaga pekerjaan Colony agar tidak liar dan bisa diaudit.

### Status Task

Status resmi:

- queued;
- planning;
- approved;
- running;
- review;
- blocked;
- done;
- archived.

### Perilaku

1. Task dibuat dengan objective dan acceptance criteria.
2. Task masuk status awal yang valid.
3. Perubahan status harus mengikuti state transition.
4. Task blocked wajib punya blocked reason.
5. Task done wajib punya evidence.
6. Task review/done memicu evaluation hook bila belum ada quality evidence.

### Output

- task record;
- status history;
- evidence;
- quality score bila tersedia.

### Batas

- task tidak boleh langsung dianggap selesai tanpa evidence;
- task tidak boleh melakukan aksi di luar scope agent;
- task tidak boleh auto-approve hanya karena quality score bagus.

## 8. Fitur 5 - Evidence dan Evaluation

### Tujuan

Membuat hasil kerja bisa dinilai, bukan hanya selesai secara status.

### Perilaku

1. Worker/reviewer menambahkan evidence ke task.
2. Saat task masuk review atau done, sistem mengecek apakah quality evidence sudah ada.
3. Jika belum ada, sistem menambahkan quality score.
4. Score bersifat deterministic/advisory pada v1.
5. Score tidak memicu approval otomatis.

### Quality Metadata

- `quality_score`;
- `quality_verdict`;
- `quality_dimensions`.

### Output

- quality evidence;
- score per task;
- dasar untuk mission outcome.

### Batas

- evaluation tidak memakai LLM call pada baseline v1;
- evaluation bukan pengganti founder/reviewer judgment.

## 9. Fitur 6 - Lesson Memory

### Tujuan

Mengubah hasil mission menjadi pembelajaran internal agar kesalahan tidak diulang.

### Perilaku

1. Mission diselesaikan dengan outcome summary.
2. Sistem membuat lesson idempotent per mission.
3. Lesson diklasifikasikan.
4. Lesson disimpan Redis-only pada v1.
5. Lesson dapat dilihat untuk review internal.

### Kategori Lesson

- quality_high;
- quality_low;
- blocked_pattern;
- scope_change;
- general.

### Aturan Penting

Jika `blockedCount >= 2`, kategori `blocked_pattern` harus lebih diprioritaskan daripada `quality_low`.

### Batas

- lesson tidak otomatis masuk Qdrant;
- lesson tidak otomatis mengubah roadmap;
- lesson retrieval ke planner bersifat advisory-only, tidak auto-replan, tidak auto-retry, dan tidak auto-create task.

## 10. Fitur 7 - Patch Proposal

### Tujuan

Memungkinkan agent mengusulkan perubahan kode secara aman dan terkontrol.

### Perilaku

1. Agent membuat patch proposal.
2. Sistem memvalidasi path dan content.
3. Proposal masuk review.
4. Founder/internal command dapat approve.
5. Apply patch tetap founder-controlled.

### Output

- patch proposal;
- validation result;
- approval status;
- audit record.

### Batas

- agent tidak boleh apply patch sendiri;
- patch tidak boleh melewati safety checks;
- applyPatch tidak boleh diekspos sembarang dari general barrel.

## 11. Fitur 8 - Verifier Gate

### Tujuan

Mencegah patch yang sudah terbukti gagal verification masuk approval.

### Perilaku

1. Verifier menjalankan command yang diizinkan.
2. Command result disimpan sebagai verification record.
3. Saat approval, sistem mengecek record.
4. Jika record ada dan status `failed`, approval diblokir untuk semua patch.
5. Jika patch `estimatedRisk=high`, approval/apply wajib menunggu verification `verified`.
6. Jika low/medium risk masih missing/pending, baseline v0D masih allow.

### Command Whitelist

- `npm run typecheck`;
- `npm run build`;
- `npm test`.

### Output

- verification record;
- failed check names;
- approval block reason bila gagal.

### Batas

- verifier tidak boleh menjalankan command arbitrary;
- v0D belum mewajibkan passed verification untuk semua patch;
- high-risk patch sudah wajib passed verification.

## 11A. Fitur 8A - Context Budget Manager

### Tujuan

Mencegah prompt Colony/research terlalu panjang atau noisy dengan memilih fragmen memori yang paling layak dipakai.

### Perilaku

1. Sistem menerima kandidat fragmen dari Qdrant/retrieval.
2. Sistem memberi skor gabungan berdasarkan relevansi, prioritas sumber, kategori, trust level, recency, dan keyword match.
3. Sistem menolak kandidat di bawah minimum score.
4. Sistem menolak duplikasi source-chunk.
5. Sistem memilih fragmen sampai batas jumlah dan batas karakter terpenuhi.
6. Sistem mengembalikan statistik input, selected, rejected, usedChars, maxChars, dan maxFragments.

### Output

- selected context fragments;
- rejected context fragments beserta reason;
- context budget stats.

### Batas

- tidak menulis ke Redis/Qdrant;
- tidak melakukan browsing eksternal;
- tidak mengubah isi memori sumber;
- truncation hanya menjadi guard ukuran akhir, bukan pengganti selector.

## 12. Fitur 9 - Model Arena

### Tujuan

Mencatat model mana yang bagus untuk tugas tertentu berdasarkan data.

### Perilaku

1. Sistem mencatat modelId dan taskType.
2. Sistem mencatat score, latency, dan outcome bila tersedia.
3. Sistem mencatat runtime event dari worker: latency, outcome success/failed, source, taskId, agentRole, dan errorCode aman.
4. Sistem tidak menyimpan raw prompt, raw output, response mentah, atau chain-of-thought privat di event runtime.
5. Sistem menyusun agregasi performa.
6. Sistem memberi rekomendasi advisory.

### Output

- model performance record;
- aggregate summary;
- advisory recommendation.

### Batas

- tidak auto-route production task pada v1;
- remote worker tidak boleh menjadi default brain tanpa policy;
- model arena tidak menggantikan founder decision.
- model arena runtime event hanya observability internal, bukan bahan publik mentah.

## 13. Fitur 10 - Founder/Internal Console

### Tujuan

Memberikan pusat kendali internal untuk founder dan operator.

### Perilaku

Console harus dapat menampilkan atau mengarah ke:

- chat cockpit;
- mission list;
- task list;
- task detail;
- evidence;
- evaluation;
- lesson memory;
- verifier records;
- model arena;
- memory/source docs;
- admin/token/usage bila relevan.

### Batas

- public user tidak boleh melihat console internal;
- sensitive actions harus role-gated;
- UI tidak boleh menjadi satu-satunya guard.

## 14. Fitur 11 - Downstream Agents

### Tujuan

Menyiapkan Kiting AI, Ting AI, dan G7 Motherbox sebagai produk turunan tanpa mencampur dapur Colony.

### Perilaku Umum

1. Agent dipilih berdasarkan mode/domain.
2. Agent memakai persona dan refusal policy masing-masing.
3. Agent hanya memakai memory/tool sesuai scope.
4. Agent melakukan escalation bila permintaan melewati batas.

### Kiting AI

Fokus:

- task umum;
- dokumen;
- checklist;
- drafting;
- ringkasan.

Batas:

- tidak mengakses Colony internals;
- tidak auto-send outreach;
- tidak menangani credential.

### Ting AI

Fokus:

- financial risk;
- edukasi;
- skenario;
- risk memo.

Batas:

- bukan nasihat keuangan final;
- tidak memberi instruksi beli/jual pasti;
- tidak mengelola dana;
- wajib disclosure risiko.

### G7 Motherbox

Fokus:

- API gateway;
- akses intelligence terkontrol;
- routing produk eksternal.

Batas:

- tidak membuka internal Colony runtime;
- tidak bypass billing/auth/governance.

## 15. Fitur 12 - Audit dan Logging

### Tujuan

Membuat semua aksi penting bisa ditinjau ulang.

### Perilaku

Sistem harus mencatat:

- task creation/status;
- mission completion;
- patch proposal;
- approval;
- verifier result;
- scheduler/worker action;
- relevant admin action.

### Output

- audit log;
- daily/weekly report;
- handoff bila blocked.

## 16. Acceptance Criteria FSD v1

FSD v1 dianggap cukup bila:

- semua fitur utama PRD/SRS sudah punya perilaku;
- batas fitur jelas;
- output tiap fitur jelas;
- downstream agent boundary tidak bercampur Colony;
- v0D open items terlihat.

## 17. Open Items untuk Dokumen Berikutnya

Dokumen berikutnya:

1. UI/UX Flow v1 untuk menentukan layar dan alur klik.
2. ERD/Data Model v1 untuk menentukan entitas dan field.
3. Backlog cleanup untuk menurunkan dokumen ini menjadi task.

Open item teknis:

- Reasoning Trace;
- Mission Planner v1;
- UI founder review untuk status verifier high-risk/missing/pending;
- UI founder review untuk lesson/verifier/model arena;
- migration plan dari staging Ryzen ke Dell R530.
