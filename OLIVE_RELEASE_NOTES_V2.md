# JAGAT G7 — Olive V2 | Patch Awal Fondasi Otonomi

Tanggal: 5 November 2026. **Paket source-code**, bukan deployment teruji di RDP.

## Apa yang diperbaiki

| Area | Perubahan | Batasan |
| --- | --- | --- |
| Mission/task persistence | `src/colony/mission-ledger.ts`: SQLite berbasis `node:sqlite`, snapshot mission/task dan append-only event history, atomic transaction, task version check | Opt-in; Node >=22.16; fitur `node:sqlite` masih experimental di Node 22 |
| Integrasi | `mission-engine.ts` dan `task-engine.ts` mengutamakan ledger ketika aktif, kemudian memproyeksikan ke Redis | Redis tetap diperlukan untuk scheduler; kerja multi-proses belum diuji |
| Boot/restart | `src/index.ts` memanggil `reconcileLedgerAndRedis()` sebelum scheduler; mengimpor status Redis lama, membangun ulang indeks, memperbaiki counter ID | Tidak mengulang otomatis tugas yang terganggu / email yang hasilnya ambigu |
| Autonomous planning review | `mission-review.ts`: pemeriksaan blocker, dependency, evidence/review, approval, dan task lama yang stuck | **Advisory-only**; tidak menjalankan perubahan strategi secara otomatis dan bukan AGI |
| API | GET `/colony/missions/:missionId/review` (executive); GET `/colony/ops/mission-ledger` (founder) | Auth yang sudah ada tetap dipakai |
| RDP safety | `os-tools.ts`: shell tool mati default, pemeriksaan path dan symlink; `react-engine.ts` tidak mengekspos shell tool saat dinonaktifkan | Opt-in shell berbahaya bila tidak diisolasi; jangan diaktifkan di host RDP |
| Email | `scripts/revenue-outreach-email.mjs` mensyaratkan `--confirm-send` dan daftar penerima yang disetujui; mencatat `attempted` sebelum SMTP dan memperbaiki variabel template | Belum implementasi antrean exactly-once / rollback SMTP; tak ada pengiriman email saat pengujian |
| Network | Redis dan Qdrant di Docker hanya dipublikasikan pada loopback `127.0.0.1` | Akses dari host lain perlu desain private network secara eksplisit |
| Tests | `scripts/mission-ledger-smoke.mjs` + npm script `test:mission-ledger` | Tidak ada dependensi Node terpasang di lingkungan audit; full build/test belum diverifikasi |

## Perubahan yang TIDAK dilakukan

- Tidak menambah planner LLM baru dan tidak mengganti router Llama/Qwen/Gemini/GPT/Grok.
- Tidak mengubah fungsi API existing dan tidak menjalankan crawling atau external API.
- Tidak mengaktifkan auto-email, auto shell, atau perubahan pada server RDP pengguna.
- Tidak menambahkan PGlite. **PGlite dan klaim 21 tabel tidak tampak dalam source code paket ini.** SQLite dipilih sebagai opsi ledger lokal yang tidak menambah dependensi npm.
- Belum ada validasi kesesuaian terhadap database dan runtime production RDP.

## Instalasi aman (staging dulu)

1. **Backup:** simpan ZIP lama, konfigurasi `.env`, Redis RDB/AOF/volume, dan database/artefak operasi. Jangan overwrite instalasi lama. Jalankan dari direktori salinan staging.
2. Pastikan Node.js **22.16+** dan `npm install` dengan koneksi yang tersedia. `node:sqlite` pada Node 22 memberikan ExperimentalWarning.
3. Jalankan `npm run build` dan `npm run test:mission-ledger` pada mesin staging. Uji juga regresi yang relevan dari proyek ini.
4. Set `JAGAT_MISSION_LEDGER_ENABLED=true` dan `JAGAT_MISSION_LEDGER_PATH=<absolute path to persistent SSD location>` di `.env`. **Pastikan volume writable dan benar-benar persisten.** Redis harus dapat diakses saat rekonsiliasi. Lakukan pertama kali saat worker/scheduler dan proses penulis lain dihentikan.
5. Startup akan mengimpor mission/task dari Redis yang tersedia dan menduplikasi snapshot status ke SQLite. Verifikasi dengan GET `/colony/ops/mission-ledger` melalui autentikasi founder, periksa daftar missions/tasks, lalu uji restart sebelum membuka scheduler lagi.
6. Untuk task `running` ketika server mati, periksa bukti eksekusi dan tindakan eksternal sebelum retry. Tidak ada auto-replay. Jangan menjalankan proses writer tambahan ke file SQLite yang sama tanpa pengujian konkurensi.
7. Pastikan monitoring backup SQLite mencakup WAL/SHM, gunakan online backup/checkpoint yang benar atau hentikan layanan saat backup file mentah. Simpan file database jauh dari public web directory dan repository.

**Rollback:** hentikan service, set `JAGAT_MISSION_LEDGER_ENABLED=false`, pulihkan konfigurasi lama dan backup Redis sesuai prosedur. Snapshot lama di SQLite tetap tersimpan; rollback ke Redis tanpa sinkronisasi berisiko kehilangan perubahan terbaru. Verifikasi keduanya sebelum meneruskan operasi.

## Perintah uji

```bash
npm install
npm run build
npm run test:mission-ledger
node --check scripts/revenue-outreach-email.mjs
```

Contoh manual email (hanya untuk alamat yang **sudah menyetujui komunikasi**):

```bash
node scripts/revenue-outreach-email.mjs someone@example.com --confirm-send --approved-list=/safe/path/approved-emails.txt
```

`approved-emails.txt` berisi satu alamat email per baris. Mode massal juga butuh file persetujuan; jangan gunakan tanpa memeriksa daftar, aturan privasi, dan kepatuhan pengiriman. Catatan `attempted` membuat pengiriman dengan hasil tidak pasti harus diverifikasi secara manual sebelum mencoba ulang.

## Tes yang benar-benar telah dilakukan di lingkungan audit

- Pengujian **isolated** terhadap SQLite ledger (commit, pembacaan setelah buka ulang, version-CAS, event audit): **PASS**.
- Pengujian **isolated** os-tools (shell disabled, cegah traversal dan symlink ke luar workspace): **PASS**.
- `node --check` pada script email: **PASS**.
- Full `npm run build`, live worker, Redis/Qdrant/PGlite, dan dashboard: **BELUM TERUJI** karena dependensi package tidak tersedia dan instalasi dependency tidak selesai.

### Prioritas lanjutan

1. Uji integrasi Redis+SQLite dalam lingkungan staging RDP pada restart dan worker concurrent; tambah tes end-to-end.
2. Verifikasi idempotensi efek eksternal dengan *outbox* transaksional untuk SMTP dan tindakan browser.
3. Tambahkan lease/heartbeat persisten dan mekanisme recovery tugas `running` berdasarkan sumber kebenaran ledger.
4. Hubungkan keluaran `mission-review` dengan planner LLM dalam siklus evaluasi **dengan approval gate**.
5. Audit keamanan API, auth, tool permissions, serta monitoring operasional sebelum penjualan atau deployment.

