# Proposal: Workflow Otonom JAGAT G7

Status: rancangan approval per penerima dan versi pesan disetujui founder; implementasi bertahap.
Tanggal: 2026-11-05.

## Alur yang sudah operasional

1. Windows Scheduled Task `JAGAT Autonomous Revenue Agent V1` menjalankan `scripts/run-autonomous-revenue-cycle-v1.ps1` setiap 3 jam pada instalasi saat ini.
2. Discovery Puppeteer menelusuri direktori publik dengan cursor, memvalidasi MX, dan menambah prospek email ke tracker. Brief menilai prioritas dan membuat laporan; draft agent membuat email serta approval inbox.
3. Dua ringkasan menuju Telegram founder. Exit code siklus menunjukkan kegagalan tahap. Artefak utama: `latest-prospect-discovery.md`, `latest-revenue-brief.md`, `EMAIL_DRAFTS_TODAY.md`, dan `OUTREACH_APPROVAL_INBOX.md`.
4. C6 Colony scheduler menangani task pengembangan berisiko rendah sesuai policy. Perubahan arsitektur, patch berisiko tinggi, deployment, dan security model tetap melalui approval founder serta verifier.

## Outbound email otomatis dengan approval manual

- Founder menyetujui **penerima dan versi pesan yang tepat**; persetujuan berisi alamat email, hash draf, campaign ID, waktu kedaluwarsa, dan batas jumlah kirim.
- Worker hanya mengambil approval yang masih berlaku. Semua email diperiksa ulang terhadap suppression/penolakan, status tracker, dan ledger `attempted/sent/unknown` sebelum SMTP.
- Tulis event `attempted` secara durable sebelum SMTP. Jika hasilnya ambigu, tahan retry otomatis dan minta pemeriksaan manual. Simpan message ID setelah sukses.
- Batasi per domain, per hari, dan per siklus; tambahkan lock agar dua scheduler tidak mengirim email yang sama. Semua error dan jumlah terkirim dilaporkan ke Telegram tanpa data sensitif.
- File approval per-draft (penerima + hash + founder + expiry) adalah allowlist tepat untuk satu penerima; worker menambahkan `--confirm-send` saat memprosesnya. Tidak diperlukan allowlist batch tambahan untuk mode single-recipient. Jangan gunakan `revenue:outreach:send` yang hanya memiliki switch global `-Approved` sebagai worker produksi.
- Uji dengan fake SMTP, kasus duplikat, crash setelah `attempted`, penolakan penerima, approval kedaluwarsa, dan dua worker bersamaan. Aktivasi hanya setelah review founder atas kebijakan outbound dan security model.

## Audit sender saat ini (2026-11-05)

Persetujuan founder diterima pada 2026-11-05. D-043 tetap berlaku: worker tidak boleh melakukan blast massal. Implementasi wajib memproses satu pesan dengan approval eksplisit yang cocok dengan isi draf, penerima, dan masa berlaku.

- `scripts/revenue-outreach-email.mjs` sekarang menolak `--blast-all`. Mode penerima tunggal menyediakan `--preview` yang menghasilkan SHA-256 untuk alamat, subject, text, dan HTML; pengiriman memerlukan file approval dengan `to`, `draftHash`, `approvalId`, `approvedBy: "Faturachman Al Kahfi"`, dan `expiresAt` yang valid.
- Gate approval diverifikasi sebelum adapter SMTP diinisialisasi. Uji dengan hash salah dan expiry invalid sama-sama ditolak dengan exit code 1. Mode satu penerima mencatat `attempted/sent/failed`; exception menghasilkan exit code gagal.
- `scripts/email-outreach-draft-agent-v1.mjs` kini menghasilkan `ops/revenue/OUTREACH_DRAFTS.json` berisi recipient, subject, text, escaped HTML, dan SHA-256 yang sama formatnya dengan sender; hash ditampilkan juga di approval inbox. Uji run lokal menghasilkan 3 payload dan seluruh hash tervalidasi.
- Sender kini membaca `OUTREACH_DRAFTS.json` dan mengirim payload exact yang sama dengan hash draft. Approval invalid ditolak sebelum adapter SMTP. `scripts/approve-outreach-draft.mjs` membuat approval lokal dengan recipient/hash/Founder/ID/expiry maksimum 24 jam dan tidak menimpa approval lama.
- Sender memakai lock eksklusif per hash dari ledger check sampai hasil SMTP tercatat. Crash meninggalkan lock dan memerlukan rekonsiliasi manual.
- `scripts/revenue-outreach-autosend-v1.ps1` kini berhenti dengan exit code 2 sebelum membaca tracker atau menginisialisasi SMTP. Package alias legacy tetap ada, tetapi fail-closed.
- `scripts/process-approved-outreach.mjs` memproses berurutan approval valid yang masih cocok dengan draft kini, memanggil sender single-recipient, dan melewati hash yang sudah berstatus `attempted/sent/unknown`. Scheduled revenue cycle memanggil worker ini hanya jika discovery, brief, dan draft generation lulus.
- `ops/revenue/SUPPRESSION_LIST.json` menjadi sumber suppression durable untuk sender dan draft generator. Seed opt-out historis `cs@abmlogistics.co.id` dimasukkan; sender fail-closed jika daftar hilang/rusak dan mendukung `node scripts/revenue-outreach-email.mjs <email> --suppress-email` untuk opt-out idempotent.
- Fake SMTP sender smoke kini menguji suppression, approval mismatch, draft valid (`attempted → sent`), Telegram outcome melalui adapter palsu, dan replay yang diblok ledger. Perintah: `npm run test:revenue-outreach-sender`.
- Pengiriman berkala aktif sebagai worker approval-only: tanpa file approval, hasilnya no-op. Founder dapat melihat hash di `OUTREACH_APPROVAL_INBOX.md`, membuat approval satu penerima memakai `scripts/approve-outreach-draft.mjs`, lalu scheduled cycle mengambil approval yang sah. Sender mengunci satu proses, membatasi maksimal 1 pesan per siklus dan 5 percobaan (attempted/sent/unknown) per hari; approval exact menjadi allowlist satu penerima. Sebelum rollout penuh masih perlu sinkronisasi opt-out inbound ke daftar durable, tes expiry/crash/concurrency, dan review manual draft serta target. Outcome sent/failed/unknown dikirim ke Telegram; Telegram bukan sumber approval. D-043 tetap melarang blast massal.

## Kondisi yang menahan aktivasi

- D-043 melarang auto-send massal. Approval per-draft durable tersedia; worker mengambil satu penerima/hash yang disetujui per siklus (maksimal 5 percobaan/hari) dan masa berlakunya belum lewat.
- `src/colony/telegram-bot.ts` masih mengeksekusi shell command dari keluaran model. Jangan jadikan chat Telegram approval otoritatif sebelum boundary command diperbaiki.
- Qdrant yang tidak tersedia menurunkan RAG dan aggregate health, tetapi bukan dependency langsung C6; scheduler memakai Redis. Kode C6 terbaru belum dimuat karena proses BFF aktif mendahului build, sehingga live validation memerlukan reload BFF terotorisasi.

## Proposal loop pengembangan aman

### Alur target

1. Director memilih task yang sudah tercatat di backlog dan membuat mission/task dengan acceptance criteria serta sumber kebenaran.
2. Policy menandai coding, patch, build, scheduler, credential, deployment, dan security sebagai founder-gated. Task low-risk non-mutating boleh diproses C6 oleh reporter, researcher, atau planner.
3. Setelah approval task, Builder membaca workspace melalui worker sandbox dan menghasilkan **patch proposal** saja. Worker tidak mendapat shell, tidak mengubah file langsung, dan tidak mengirim pesan/email eksternal.
4. Orchestrator menjalankan verifier allowlist (`typecheck`, `build`, dan test yang disetujui) di luar worker, menyimpan hasil sebagai evidence, lalu menolak approval patch jika verifikasi gagal atau belum lengkap sesuai tingkat risikonya.
5. Founder meninjau diff/evidence dan menyetujui apply melalui Command Center. Telegram mengirim status ringkas dan tautan/id task; Telegram tidak menerima approval patch atau command bebas.
6. Reporter memperbarui task, mission summary, handoff, dan backlog setelah hasil diverifikasi.

### Batas aktivasi

- Tahap 1 tanpa perubahan security model: setelah reload BFF terotorisasi, verifikasi `/colony/scheduler/status` dengan sesi founder dan Redis sehat; jalankan satu task low-risk no-write lalu cocokkan audit/evidence. Pulihkan Qdrant terpisah untuk RAG dan aggregate health.
- Tahap 2 disetujui founder pada 2026-11-05: Builder boleh otomatis membuat patch proposal untuk task C6 berprioritas low yang diberi tag `founder-approved-low-risk-patch-proposal`. Kata kunci risiko tinggi tetap memerlukan founder approval; worker hanya membaca/mencari file, tidak punya shell, dan tidak dapat apply patch.
- C6 verifier/orchestration, task creation dari backlog, dan runtime end-to-end belum tervalidasi. Apply tetap founder-approved; auto-apply, auto-deploy, perubahan `.env`, serta email tanpa approval per penerima/hash tetap di luar cakupan.
- Auto-apply, auto-deploy, perubahan `.env`, serta email tanpa approval per penerima/hash tetap di luar cakupan.

### Acceptance criteria pengembangan

- Setiap run berawal dari backlog ID dan menghasilkan mission/task, audit event, status, serta evidence yang dapat dilihat founder.
- Tidak ada worker shell; seluruh file mutation melewati patch engine dan founder approval.
- Verifier berjalan di orchestration dengan command allowlist dan mencatat exit code serta waktu; kegagalan memblokir apply.
- Telegram hanya menyampaikan status perubahan dan tidak dapat mengubah approval/task melalui natural language.
- C6 live status terverifikasi melalui endpoint authenticated; hasil tetap advisory sampai acceptance/evidence diverifikasi.

## Kriteria penerimaan

Siklus discovery/brief/draft dan Telegram berjalan berulang tanpa pengiriman ke calon klien; email hanya terkirim untuk approval per pesan yang sah; duplicate/unknown ditahan; audit dan status mudah dipantau founder; `tsc --noEmit`, build, ledger test, serta simulasi SMTP lulus.

### Builder opt-in UI (2026-11-05)
- Colony task form exposes a founder toggle only for Builder + phase C6 + low priority. It sets `founder-approved-low-risk-patch-proposal` and disables task-start approval only while selected. Scope changes clear the selection.
- Builder remains proposal-only; founder approval route is still required to apply. UI build passed; service was not restarted.

### C6 backlog intake hook (2026-11-05)
- Scheduler calls backlog intake once before claiming tasks. It considers `Auto-Propose`, `Candidate`, or `Ready` rows only when low-risk filters pass; one item maximum per tick, duplicate IDs are skipped, policy is rechecked, and task source is audited. `Planned` rows remain excluded.
- Intake errors do not halt normal scheduler claims. No row currently opts in, and the backend has not been restarted, so this source change is not live yet.
# Proposal: Workflow Otonom JAGAT G7

Status: rancangan approval per penerima dan versi pesan disetujui founder; implementasi bertahap.
Tanggal: 2026-11-05.

## Alur yang sudah operasional

1. Windows Scheduled Task `JAGAT Autonomous Revenue Agent V1` menjalankan `scripts/run-autonomous-revenue-cycle-v1.ps1` setiap 3 jam pada instalasi saat ini.
2. Discovery Puppeteer menelusuri direktori publik dengan cursor, memvalidasi MX, dan menambah prospek email ke tracker. Brief menilai prioritas dan membuat laporan; draft agent membuat email serta approval inbox.
3. Dua ringkasan menuju Telegram founder. Exit code siklus menunjukkan kegagalan tahap. Artefak utama: `latest-prospect-discovery.md`, `latest-revenue-brief.md`, `EMAIL_DRAFTS_TODAY.md`, dan `OUTREACH_APPROVAL_INBOX.md`.
4. C6 Colony scheduler menangani task pengembangan berisiko rendah sesuai policy. Perubahan arsitektur, patch berisiko tinggi, deployment, dan security model tetap melalui approval founder serta verifier.

## Outbound email otomatis dengan approval manual

- Founder menyetujui **penerima dan versi pesan yang tepat**; persetujuan berisi alamat email, hash draf, campaign ID, waktu kedaluwarsa, dan batas jumlah kirim.
- Worker hanya mengambil approval yang masih berlaku. Semua email diperiksa ulang terhadap suppression/penolakan, status tracker, dan ledger `attempted/sent/unknown` sebelum SMTP.
- Tulis event `attempted` secara durable sebelum SMTP. Jika hasilnya ambigu, tahan retry otomatis dan minta pemeriksaan manual. Simpan message ID setelah sukses.
- Batasi per domain, per hari, dan per siklus; tambahkan lock agar dua scheduler tidak mengirim email yang sama. Semua error dan jumlah terkirim dilaporkan ke Telegram tanpa data sensitif.
- File approval per-draft (penerima + hash + founder + expiry) adalah allowlist tepat untuk satu penerima; worker menambahkan `--confirm-send` saat memprosesnya. Tidak diperlukan allowlist batch tambahan untuk mode single-recipient. Jangan gunakan `revenue:outreach:send` yang hanya memiliki switch global `-Approved` sebagai worker produksi.
- Uji dengan fake SMTP, kasus duplikat, crash setelah `attempted`, penolakan penerima, approval kedaluwarsa, dan dua worker bersamaan. Aktivasi hanya setelah review founder atas kebijakan outbound dan security model.

## Audit sender saat ini (2026-11-05)

Persetujuan founder diterima pada 2026-11-05. D-043 tetap berlaku: worker tidak boleh melakukan blast massal. Implementasi wajib memproses satu pesan dengan approval eksplisit yang cocok dengan isi draf, penerima, dan masa berlaku.

- `scripts/revenue-outreach-email.mjs` sekarang menolak `--blast-all`. Mode penerima tunggal menyediakan `--preview` yang menghasilkan SHA-256 untuk alamat, subject, text, dan HTML; pengiriman memerlukan file approval dengan `to`, `draftHash`, `approvalId`, `approvedBy: "Faturachman Al Kahfi"`, dan `expiresAt` yang valid.
- Gate approval diverifikasi sebelum adapter SMTP diinisialisasi. Uji dengan hash salah dan expiry invalid sama-sama ditolak dengan exit code 1. Mode satu penerima mencatat `attempted/sent/failed`; exception menghasilkan exit code gagal.
- `scripts/email-outreach-draft-agent-v1.mjs` kini menghasilkan `ops/revenue/OUTREACH_DRAFTS.json` berisi recipient, subject, text, escaped HTML, dan SHA-256 yang sama formatnya dengan sender; hash ditampilkan juga di approval inbox. Uji run lokal menghasilkan 3 payload dan seluruh hash tervalidasi.
- Sender kini membaca `OUTREACH_DRAFTS.json` dan mengirim payload exact yang sama dengan hash draft. Approval invalid ditolak sebelum adapter SMTP. `scripts/approve-outreach-draft.mjs` membuat approval lokal dengan recipient/hash/Founder/ID/expiry maksimum 24 jam dan tidak menimpa approval lama.
- Sender memakai lock eksklusif per hash dari ledger check sampai hasil SMTP tercatat. Crash meninggalkan lock dan memerlukan rekonsiliasi manual.
- `scripts/revenue-outreach-autosend-v1.ps1` kini berhenti dengan exit code 2 sebelum membaca tracker atau menginisialisasi SMTP. Package alias legacy tetap ada, tetapi fail-closed.
- `scripts/process-approved-outreach.mjs` memproses berurutan approval valid yang masih cocok dengan draft kini, memanggil sender single-recipient, dan melewati hash yang sudah berstatus `attempted/sent/unknown`. Scheduled revenue cycle memanggil worker ini hanya jika discovery, brief, dan draft generation lulus.
- `ops/revenue/SUPPRESSION_LIST.json` menjadi sumber suppression durable untuk sender dan draft generator. Seed opt-out historis `cs@abmlogistics.co.id` dimasukkan; sender fail-closed jika daftar hilang/rusak dan mendukung `node scripts/revenue-outreach-email.mjs <email> --suppress-email` untuk opt-out idempotent.
- Fake SMTP sender smoke kini menguji suppression, approval mismatch, draft valid (`attempted â†’ sent`), Telegram outcome melalui adapter palsu, dan replay yang diblok ledger. Perintah: `npm run test:revenue-outreach-sender`.
- Pengiriman berkala aktif sebagai worker approval-only: tanpa file approval, hasilnya no-op. Founder dapat melihat hash di `OUTREACH_APPROVAL_INBOX.md`, membuat approval satu penerima memakai `scripts/approve-outreach-draft.mjs`, lalu scheduled cycle mengambil approval yang sah. Sender mengunci satu proses, membatasi maksimal 1 pesan per siklus dan 5 percobaan (attempted/sent/unknown) per hari; approval exact menjadi allowlist satu penerima. Sebelum rollout penuh masih perlu sinkronisasi opt-out inbound ke daftar durable, tes expiry/crash/concurrency, dan review manual draft serta target. Outcome sent/failed/unknown dikirim ke Telegram; Telegram bukan sumber approval. D-043 tetap melarang blast massal.

## Kondisi yang menahan aktivasi

- D-043 melarang auto-send massal. Approval per-draft durable tersedia; worker mengambil satu penerima/hash yang disetujui per siklus (maksimal 5 percobaan/hari) dan masa berlakunya belum lewat.
- `src/colony/telegram-bot.ts` masih mengeksekusi shell command dari keluaran model. Jangan jadikan chat Telegram approval otoritatif sebelum boundary command diperbaiki.
- Qdrant yang tidak tersedia menurunkan RAG dan aggregate health, tetapi bukan dependency langsung C6; scheduler memakai Redis. Kode C6 terbaru belum dimuat karena proses BFF aktif mendahului build, sehingga live validation memerlukan reload BFF terotorisasi.

## Proposal loop pengembangan aman

### Alur target

1. Director memilih task yang sudah tercatat di backlog dan membuat mission/task dengan acceptance criteria serta sumber kebenaran.
2. Policy menandai coding, patch, build, scheduler, credential, deployment, dan security sebagai founder-gated. Task low-risk non-mutating boleh diproses C6 oleh reporter, researcher, atau planner.
3. Setelah approval task, Builder membaca workspace melalui worker sandbox dan menghasilkan **patch proposal** saja. Worker tidak mendapat shell, tidak mengubah file langsung, dan tidak mengirim pesan/email eksternal.
4. Orchestrator menjalankan verifier allowlist (`typecheck`, `build`, dan test yang disetujui) di luar worker, menyimpan hasil sebagai evidence, lalu menolak approval patch jika verifikasi gagal atau belum lengkap sesuai tingkat risikonya.
5. Founder meninjau diff/evidence dan menyetujui apply melalui Command Center. Telegram mengirim status ringkas dan tautan/id task; Telegram tidak menerima approval patch atau command bebas.
6. Reporter memperbarui task, mission summary, handoff, dan backlog setelah hasil diverifikasi.

### Batas aktivasi

- Tahap 1 tanpa perubahan security model: setelah reload BFF terotorisasi, verifikasi `/colony/scheduler/status` dengan sesi founder dan Redis sehat; jalankan satu task low-risk no-write lalu cocokkan audit/evidence. Pulihkan Qdrant terpisah untuk RAG dan aggregate health.
- Tahap 2 disetujui founder pada 2026-11-05: Builder boleh otomatis membuat patch proposal untuk task C6 berprioritas low yang diberi tag `founder-approved-low-risk-patch-proposal`. Kata kunci risiko tinggi tetap memerlukan founder approval; worker hanya membaca/mencari file, tidak punya shell, dan tidak dapat apply patch.
- C6 verifier/orchestration, task creation dari backlog, dan runtime end-to-end belum tervalidasi. Apply tetap founder-approved; auto-apply, auto-deploy, perubahan `.env`, serta email tanpa approval per penerima/hash tetap di luar cakupan.
- Auto-apply, auto-deploy, perubahan `.env`, serta email tanpa approval per penerima/hash tetap di luar cakupan.

### Acceptance criteria pengembangan

- Setiap run berawal dari backlog ID dan menghasilkan mission/task, audit event, status, serta evidence yang dapat dilihat founder.
- Tidak ada worker shell; seluruh file mutation melewati patch engine dan founder approval.
- Verifier berjalan di orchestration dengan command allowlist dan mencatat exit code serta waktu; kegagalan memblokir apply.
- Telegram hanya menyampaikan status perubahan dan tidak dapat mengubah approval/task melalui natural language.
- C6 live status terverifikasi melalui endpoint authenticated; hasil tetap advisory sampai acceptance/evidence diverifikasi.

## Kriteria penerimaan

Siklus discovery/brief/draft dan Telegram berjalan berulang tanpa pengiriman ke calon klien; email hanya terkirim untuk approval per pesan yang sah; duplicate/unknown ditahan; audit dan status mudah dipantau founder; `tsc --noEmit`, build, ledger test, serta simulasi SMTP lulus.

### Builder opt-in UI (2026-11-05)
- Colony task form exposes a founder toggle only for Builder + phase C6 + low priority. It sets `founder-approved-low-risk-patch-proposal` and disables task-start approval only while selected. Scope changes clear the selection.
- Builder remains proposal-only; founder approval route is still required to apply. UI build passed; service was not restarted.

### C6 backlog intake hook (2026-11-05)
- Scheduler calls backlog intake once before claiming tasks. It considers only rows whose status is explicitly `Auto-Propose`, then applies low-risk filters; one item maximum per tick, duplicate IDs are skipped, policy is rechecked, and task source is audited. `Candidate`, `Ready`, and `Planned` remain excluded until explicitly opted in.
- Intake errors do not halt normal scheduler claims. No row currently opts in, and the backend has not been restarted, so this source change is not live yet.



### Runtime dependency check (2026-11-05 15:05 -08:00)
Backlog intake regression PASS (8 checks), and no low-risk Auto-Propose item exists in either backlog. Express responds on port 5000; /health returns 503 because Qdrant is unreachable while Ollama and Redis respond. Docker service is Stopped and port 6333 has no listener. No service was started. C6 runtime verification requires founder-authorized local maintenance, followed by authenticated scheduler status and a safe no-write task check.


### C6 runtime dependency correction (2026-11-05 15:19 -08:00)
Static dependency trace shows C6 scheduler uses Redis-backed task, queue, chat, and audit engines and has no direct Qdrant import; BFF startup continues after an unavailable Qdrant probe. Redis is currently connected. The active BFF PID 3056 began Nov 3 20:05; dist/index.js and scheduler bundle were rebuilt Nov 5 15:03, so recent backlog-intake code is not loaded in the live process. C6 runtime verification requires authorized BFF reload/restart. Starting Docker restores Qdrant/RAG but does not load new C6 code. No restart performed.


### Builder dispatch code audit (2026-11-05 15:23 -08:00)
Source trace confirms C6 routes eligible Builder tasks through the C5B real worker, which reads/searches codebase files and may submit a PATCH_PROPOSAL; it does not mutate files. Patch application remains founder-approved. Backlog intake requires explicit Auto-Propose, currently absent. Qdrant is not a direct scheduler dependency (Redis is connected); current BFF process predates the latest build, so live verification requires authorized reload/maintenance.
