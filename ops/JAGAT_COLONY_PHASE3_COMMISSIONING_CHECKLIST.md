# JAGAT Colony Phase 3 Commissioning Checklist

## Status Dokumen

Dokumen ini adalah checklist eksekusi singkat untuk `Phase 3 - Dry Run Commissioning` JAGAT Colony setelah `Phase 2 Final` disetujui.

Tujuan dokumen ini adalah memastikan commissioning dilakukan secara disiplin, dapat diaudit, dan tidak melebar ke implementasi C5 terlalu cepat.

Versi: 1.1  
Tanggal: 2026-05-28  
Status: PASS (Founder baseline + commissioning artifacts synced)  

## Commissioning Update - 2026-05-28

Status terkini: **PASS**.

Interpretasi status:

- `PASS` di dokumen ini berarti artefak commissioning yang tercatat untuk founder-only baseline, auth rejection, audit trail, C5A, C5B, dan C5B-2 sudah lengkap dan terkunci
- `PASS` **tidak** berarti multi-role matrix (`ULTRA`, `internal_ops`) sudah operational
- `PASS` juga **tidak** membatalkan kebutuhan re-check runtime bila environment aktif berubah atau bila commissioning harus diulang dari nol

Dokumen ini harus dibaca bersama:

- `ops/COLONY_DRY_RUN_TRACE.md` untuk trace auth/runtime dan residual gap
- `ops/JAGAT_COLONY_GAP_AUDIT.md` untuk baseline historical findings sebelum hardening

Yang sudah terverifikasi:

- [x] backend JAGAT berjalan di `127.0.0.1:5000`
- [x] UI JAGAT berjalan di `localhost:3000`
- [x] login founder SOVEREIGN berhasil
- [x] Founder Command Center `/colony` dapat dibuka
- [x] roster colony berisi 6 unit agent
- [x] default chat rooms muncul
- [x] chat founder tersimpan di Colony HQ
- [x] pending approval berhasil dibuat untuk `TASK-20260527-0001`
- [x] UI build pass setelah penambahan kontrol task commissioning
- [x] full lifecycle `queued -> planning -> approved -> running -> review -> done` sukses dilewati
- [x] negative auth tests lengkap dan terverifikasi
- [x] audit log verification lengkap
- [x] C5A simulated workers berjalan stabil dan lulus commissioning
- [x] C5B controlled read-only worker execution berjalan stabil dan lulus live test
- [x] rejected approval tidak menjalankan worker
- [x] approved approval menjalankan real worker, membaca/search file via sandbox, menambah evidence, dan mengubah task ke `review`
- [x] worker sandbox menolak path di luar allowed root dengan boundary direktori yang ketat
- [x] search filesystem ikut menghitung byte budget task
- [x] founder dapat melihat worker action melalui `/worker-log` dan konfigurasi sandbox melalui `/sandbox`

Patch operasional:

- Task Queue sekarang memiliki kontrol create task, status transition, evidence, block/resume, archive, dan approval request.
- Approval Inbox sekarang dapat langsung dipakai untuk approve/reject request founder.
- C5B read-only worker runtime sekarang aktif untuk agent yang memiliki permission codebase read/search.
- Worker execution tetap read-only; patch proposal dan apply patch ditahan untuk fase C5B-2 dengan approval gate.
- `ops/` read access dianggap intentional untuk fase read-only karena planner/researcher membutuhkan masterplan, decision log, backlog, dan checklist. Role-scoped allowed roots dicatat sebagai hardening C5B-2.

---

### C5B-2 Patch Proposal Engine — Security Hardening PASS (2026-05-28) 🔒

- [x] **Blocker 1**: `applyPatch` **tidak** dapat diakses dari `index.ts` — public surface menggunakan explicit named exports, bukan wildcard. `applyPatch` hanya reachable dari `command-engine.ts` yang mengimpor langsung dari `patch-engine.js`
- [x] **Blocker 2**: Semua path operasi di `patch-engine.ts` menggunakan `validatePatchPath()` dari `worker-sandbox.ts` — satu source of truth untuk role-scope, BLOCKED_PATTERNS, traversal, dan JAGAT boundary check
- [x] **Blocker 3**: `applyPatch(proposalId, actor)` menerima actor asli founder; `patch.apply` dan `patch.apply_failed` audit entries mencatat identitas founder yang sebenarnya, bukan `"system"`
- [x] **Blocker 4**: `validateHunks()` menggunakan byte-window check (bukan `line-join`) — menghitung byte offset `startLine` via `computeLineStartOffset()`, lalu mencari `originalContent` di dalam window `[startLine..endLine]`:
  - `HUNK_LINERANGE_MISMATCH`: content ada di file tapi tidak di window yang dideklarasikan
  - `HUNK_AMBIGUOUS`: content muncul >1x di file dan window yang dideklarasikan tidak mengandung satu pun occurrence
- [x] **Residual blocker R1** (fix final): `applyPatch` sebelumnya memakai `content.indexOf(orig)` yang selalu menemukan occurrence pertama. Sekarang memakai `content.indexOf(orig, computeLineStartOffset(startLine))` — replacement di-anchor ke byte offset baris yang dideklarasikan, bukan occurrence pertama di file
- [x] **Bukti R1**: fixture 5 baris dengan baris 2 dan 4 identik (`"repeated content TARGET"`); proposal menarget occurrence ke-2 (line 4); setelah apply, baris 2 tetap unchanged dan baris 4 berubah
- [x] **Attack tests** semua ditolak dengan `HUNK_PATH_DENIED`:
  - A1: `../ops/DECISION_LOG.md` traversal
  - A2: `c:/JAGAT/ops/...` di luar builder scope
  - A3: `auth.ts` blocked pattern
  - A4: `.env` blocked extension
- [x] **Ambiguity tests**: A5 (content di lines 2+4, range=5-5) → `HUNK_AMBIGUOUS`; A6 (single occurrence di line 1, range=3-3) → `HUNK_LINERANGE_MISMATCH`
- [x] **Test hygiene**: tidak ada `failed--`/`passed++` counter manipulation; tidak ada `❌ FAIL` yang tercetak untuk test yang akhirnya dihitung PASS; fixture selalu di-restore di `finally` block
- [x] `npm run typecheck` PASS — 0 errors
- [x] `npm run build` PASS
- [x] `npx tsx scripts/c5b2-live-test.mjs` PASS — **27 PASS / 0 FAIL** — tidak ada string `❌ FAIL` di output

Keputusan terkait: D-018

## Objective

Membuktikan bahwa colony:

1. dapat di-bootstrap dengan aman
2. dapat menerima mission nyata
3. dapat mengelola task lifecycle
4. dapat menjalankan approval flow founder
5. dapat menolak akses yang tidak sah
6. dapat menghasilkan audit trail yang utuh

## Scope

Phase 3 **bukan** worker execution penuh.

Phase 3 hanya menguji:

- governance flow
- mission flow
- task flow
- approval flow
- auth rejection
- audit verification

Historical note: pada versi awal, Phase 3 **tidak** mengaktifkan:

- autonomous coding loop
- scheduler 24/7
- Telegram control
- voice/call layer
- agent execution tanpa approval
- patch apply otomatis oleh agent

Update 2026-05-30/31: item di atas tetap benar untuk commissioning awal, tetapi setelah D-024 sampai D-028, C5B patch proposal/review, C6 low-risk scheduler loop, daily/weekly reporter, dan Memory Library UI sudah diaktifkan dengan founder-only controls dan runtime guard. Coding berat dan high-risk task tetap founder-gated.

## Pre-Flight Gate

Sebelum commissioning dimulai, semua syarat ini harus benar:

- [x] Phase 2 Final sudah di-sign-off
- [x] `COOKIE_SIGNING_SECRET` terpasang
- [x] `COLONY_INTERNAL_SECRET` terpasang
- [x] backend build pass
- [x] UI build pass
- [x] Redis berjalan
- [x] backend JAGAT berjalan
- [x] UI JAGAT berjalan
- [x] login founder SOVEREIGN bisa dilakukan

## Commissioning Sequence

### Step 1 — Bootstrap Colony

Action:

- akses Founder Command Center
- jalankan bootstrap colony

Expected Result:

- 6 agent resmi terdaftar
- default rooms tercipta
- audit log bootstrap tercatat

Checklist:

- [x] `POST /colony/bootstrap` sukses
- [x] roster berisi 6 unit colony
- [x] room default muncul
- [x] audit event `colony.bootstrap` muncul

### Step 2 — Create 1 Real Mission

Mission harus nyata, bukan dummy teknis kosong.

Contoh aman:

- audit backlog phase tertentu
- rapikan ingestion documentation
- siapkan prioritas mingguan founder

Checklist:

- [x] founder membuat 1 mission
- [x] mission tersimpan dan terlihat di mission board
- [x] mission memiliki title, objective, phase, priority
- [x] audit event `mission.create` muncul

### Step 3 — Break Mission into 3-5 Tasks

Task harus punya kualitas operasional, bukan placeholder.

Minimal field:

- title
- objective
- phase
- source of truth
- assigned agent
- acceptance criteria
- priority

Checklist:

- [x] minimal 3 task dibuat
- [x] maksimal 5 task untuk dry run
- [x] semua task punya acceptance criteria
- [x] semua task punya assigned agent
- [x] audit event `task.create` muncul untuk tiap task

### Step 4 — Walk One Full Task Through Lifecycle

Uji satu task melewati alur resmi:

`queued -> planning -> approved -> running -> review -> done`

Checklist:

- [x] task berpindah status sesuai urutan
- [x] tidak ada lompatan status ilegal
- [x] `running` tanpa criteria ditolak
- [x] `blocked` tanpa alasan ditolak
- [x] `done` tanpa evidence ditolak
- [x] setiap transisi muncul di transition log
- [x] setiap transisi muncul di audit log

### Step 5 — Approval Flow Founder

Ambil satu task yang memang membutuhkan founder approval.

Checklist:

- [x] approval request dibuat
- [x] approval masuk inbox founder
- [x] founder approve atau reject
- [x] `respondedBy` berasal dari verified founder identity
- [x] approval ganda pada request yang sama ditolak
- [x] audit event `approval.create` dan `approval.respond` muncul

### Step 6 — Internal Chat Verification

Gunakan room internal untuk mengirim minimal 2 pesan:

- 1 pesan founder
- 1 pesan status/update yang relevan

Checklist:

- [x] message tersimpan di room yang benar
- [x] sender identity berasal dari session terverifikasi
- [x] sender tidak bisa self-declare identity lain
- [x] audit event `chat.message_send` muncul

### Step 7 — Unauthorized Access Tests

Tes ini wajib. Jangan diskip.

#### 7A. Tanpa Cookie

- [x] request tanpa cookie ke `/api/colony/*` → `401`

#### 7B. Cookie Palsu / Dimanipulasi

- [x] cookie invalid signature → `401`
- [x] payload diubah tapi signature mismatch → `401`

#### 7C. Tier Salah

- [x] tier non-SOVEREIGN ke colony route → `403`

#### 7D. Direct Backend Access

- [x] call backend langsung tanpa proxy secret → `401`

### Step 8 — Audit Trail Verification

Checklist:

- [x] `GET /colony/audit` bisa diakses founder
- [x] event bootstrap ada
- [x] event mission create ada
- [x] event task create ada
- [x] event task status change ada
- [x] event approval ada
- [x] event chat ada
- [x] semua event punya actor
- [x] semua event punya actorRole
- [x] semua event punya timestamp
- [x] tidak ada actor kosong atau `unknown`

## Success Criteria

Phase 3 dianggap **PASS** jika:

- [x] bootstrap sukses
- [x] 1 mission nyata sukses dibuat
- [x] 3-5 task nyata sukses dibuat
- [x] 1 task melewati lifecycle penuh tanpa pelanggaran
- [x] approval flow founder sukses
- [x] unauthorized access tests semua lulus
- [x] audit trail lengkap dan konsisten

## Failure Conditions

Phase 3 dianggap **FAIL / HOLD** jika salah satu ini terjadi:

- unauthorized caller masih bisa masuk
- founder identity tidak konsisten
- approval bisa dipalsukan
- audit trail kosong atau rusak
- status task bisa dilompati tanpa validasi
- direct backend access tanpa proxy secret masih lolos

Jika FAIL:

- jangan lanjut ke C5
- catat di decision log
- buka remediation task baru

## Output Wajib Setelah Commissioning

Setelah selesai, harus ada:

- [x] commissioning notes singkat
- [x] daftar hasil PASS/FAIL
- [x] daftar bug/gap jika ada
- [x] keputusan lanjut atau hold
- [x] update ke `ops/DECISION_LOG.md`

## Decision Gate Setelah Phase 3

Jika PASS:

- lanjut ke `Phase 4 - Ready for C5`
- C5A simulated worker dan C5B read-only controlled worker execution sudah PASS pada 2026-05-28

Jika HOLD:

- tetap di fase governance hardening sampai gap ditutup

## Rekomendasi Operasional

Saat commissioning:

- gunakan 1 founder session resmi
- jangan paralelkan terlalu banyak mission
- jangan uji worker execution otomatis dulu
- fokus pada keutuhan governance

## Next Step Setelah PASS

Jika Phase 3 lolos, langkah berikutnya adalah:

1. tutup C5B read-only sebagai DONE
2. lanjut ke `C5B-2 - Patch Proposal` dengan founder approval gate
3. tambah role-scoped sandbox roots agar akses `ops/`, `src/`, dan `jagat-ui/src/` dapat dibatasi per agent
4. C6 scheduler sudah aktif untuk task ringan-sedang setelah patch proposal, review, dan approval flow worker matang; observability ditambahkan di tab C6 Runtime.
