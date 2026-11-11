# JAGAT Colony Masterplan

## Status Dokumen

Dokumen ini mendefinisikan arsitektur, peran, ritme kerja, dan jalur implementasi untuk `JAGAT Colony`: armada AI non-manusia yang bertugas sebagai tenaga kerja internal Faturachman Al Kahfi untuk membangun, merawat, mengaudit, dan mengembangkan JAGAT G7.

Dokumen ini tidak menggantikan `JAGAT_G7_EXECUTION_MASTERPLAN.md`. Dokumen ini adalah turunan operasional khusus untuk lapisan colony.

Versi: 1.0  
Tanggal: 2026-05-27  
Status: Draft Operasional Resmi

## Premis Utama

JAGAT G7 tetap merupakan produk, otak utama, dan Sovereign Super Intelligence Core.

JAGAT Colony bukan produk publik utama dan bukan identitas utama JAGAT. Colony adalah:

- armada AI non-manusia internal
- tenaga kerja digital founder
- mesin eksekusi 24/7
- lapisan orkestrasi kerja untuk pengembangan JAGAT dan tugas operasional lain

OpenClaw boleh dipakai sebagai kendaraan sementara atau shell teknis, tetapi OpenClaw bukan fondasi identitas colony dan bukan fondasi arsitektur JAGAT.

## Tujuan Strategis Colony

JAGAT Colony dibangun agar Faturachman Al Kahfi dapat menjalankan proyek besar dengan struktur manusia yang sangat kecil dan leverage AI yang sangat besar.

Tujuan colony:

1. Menurunkan visi founder menjadi rencana kerja terstruktur.
2. Menjalankan pekerjaan riset, coding, audit, dokumentasi, dan reporting secara terus-menerus.
3. Menjaga agar JAGAT tidak jatuh menjadi wrapper, chatbot generik, atau proyek tanpa disiplin.
4. Mengurangi kebutuhan prompting manual terus-menerus dari founder.
5. Menjadi tenaga kerja internal untuk pengembangan JAGAT, produk turunannya, dan tugas strategis lain sesuai arahan founder.

## Sumber Otoritas Colony

Colony tidak boleh bergerak liar. Colony harus tunduk pada dokumen sumber resmi berikut:

1. `Jagat_G7.md`
2. `JAGAT_G7_EXECUTION_MASTERPLAN.md`
3. `ops/EXECUTION_MAP_30_60_90.md`
4. `ops/WEEKLY_EXECUTION_LOOP.md`
5. `ops/DECISION_LOG.md`
6. `ops/TECHNICAL_BACKLOG.md`
7. `ops/PRODUCT_BACKLOG.md`
8. Blueprint, Roadmap, dan Milestone yang sudah diingest ke memori berdaulat

Urutan prioritas otoritas:

1. Founder direct instruction
2. Decision log terbaru
3. Execution masterplan
4. Jagat_G7.md
5. Backlog dan weekly loop
6. Dokumen memori pendukung

Jika ada konflik, instruksi founder terbaru menang.

## Prinsip Operasi Colony

1. Colony adalah tenaga eksekusi, bukan pemilik visi.
2. JAGAT Core tetap pusat identitas, memori, dan protokol penalaran.
3. Semua kerja colony harus dapat diaudit.
4. Semua keputusan penting harus memiliki jejak status dan provenance.
5. Colony harus bergerak lewat task queue, bukan percakapan acak tanpa state.
6. Tool, memory scope, dan boundary tiap agent harus jelas.
7. Fitur voice atau chat hanyalah antarmuka; mesin kerjanya tetap task-driven.
8. Jangan membuka rahasia dapur arsitektur internal ke permukaan publik.

## Model Organisasi

### Founder Layer

`Faturachman Al Kahfi`

Peran:

- pemberi arah strategis
- pemberi keputusan final
- pemberi prioritas
- evaluator hasil kerja
- pemegang approval untuk perubahan arsitektur besar

### Core Human Layer

Tetap kecil dan minimal:

- founder
- pendukung infrastruktur dan kapital
- pendukung produk/operasi seperlunya

### Colony Layer

Armada AI internal yang bekerja secara spesifik, terpisah, dan terukur.

## Unit Colony Resmi

### 1. Colony Director

Peran:

- menerjemahkan arahan founder menjadi mission
- memecah mission menjadi workstream
- memprioritaskan queue
- mengunci acceptance criteria

Tidak menulis kode langsung.

### 2. Planner / Architect Agent

Peran:

- membaca masterplan, backlog, roadmap, milestone
- menyusun urutan kerja
- mendeteksi dependency
- mengusulkan milestone berikutnya

Output:

- task plan
- dependency map
- risk flags

### 3. Research & Memory Agent

Peran:

- membaca dokumen
- mengelola ingest
- mengkurasi knowledge base
- menjaga provenance, citation, dan memory hygiene

Output:

- konteks kerja terverifikasi
- daftar gap pengetahuan
- rekomendasi ingest

### 4. Builder / Coder Agent

Peran:

- mengimplementasikan task teknis
- membuat patch
- menjalankan build dan verifikasi dasar
- mengikuti acceptance criteria yang sudah dikunci

Output:

- perubahan kode
- change summary
- hasil build/test

### 5. Reviewer / QA Agent

Peran:

- memeriksa hasil builder
- mengaudit risiko
- mengecek regresi
- memverifikasi kesesuaian terhadap phase dan scope

Output:

- review verdict
- bug list
- residual risk

### 6. Reporter / Operations Agent

Peran:

- menulis progres ke log dan backlog
- memperbarui status task
- menyusun laporan harian dan mingguan
- menyiapkan bahan rapat internal founder

Output:

- daily brief
- weekly brief
- blocker report

## Task State Machine

Setiap pekerjaan colony wajib memiliki salah satu status berikut:

- `queued`
- `planning`
- `approved`
- `running`
- `review`
- `blocked`
- `done`
- `archived`

Aturan:

- task tidak boleh langsung `running` tanpa deskripsi dan acceptance criteria
- task `blocked` wajib punya alasan
- task `done` wajib punya evidence
- task `archived` hanya untuk pekerjaan yang dihentikan atau digantikan

## Artefak Wajib per Task

Setiap task minimal menyimpan:

- `task_id`
- `title`
- `objective`
- `phase`
- `source_of_truth`
- `assigned_agent`
- `status`
- `acceptance_criteria`
- `dependencies`
- `evidence`
- `last_update`
- `founder_approval_required`

## Antarmuka Founder

Founder tidak boleh bergantung pada terminal sebagai antarmuka utama colony.

### Antarmuka yang Direkomendasikan

#### 1. Founder Command Center di UI JAGAT

Ini harus menjadi antarmuka utama.

Fitur minimum:

- mission board
- colony roster
- active task queue
- blocked items
- approval inbox
- daily summary
- weekly summary
- internal meeting transcript

#### 2. Chat Workspace Internal

Chat digunakan untuk:

- memberi arahan singkat
- meminta status
- memberi approval
- membuka rapat internal berbasis teks

Chat tidak menjadi sumber state utama. State utama tetap di task engine.

#### 3. Telegram

Telegram hanya untuk:

- notifikasi
- trigger ringan
- emergency command
- status singkat saat founder mobile

Telegram tidak direkomendasikan sebagai ruang kerja utama colony, dan tidak cocok untuk tugas besar, coding panjang, atau ingest dokumen berat.

#### 4. Terminal

Terminal hanya untuk mode engineering internal, debugging, dan maintenance.

Terminal bukan antarmuka founder-level yang ideal untuk colony.

## Rapat Internal Colony

Ya, model rapat internal bisa dibuat seperti perusahaan sungguhan.

### Mode 1: Text Meeting

Founder membuka room internal dan memanggil unit colony.

Contoh alur:

1. Reporter membuka ringkasan progres
2. Planner menjelaskan task aktif dan dependency
3. Research menjelaskan gap knowledge
4. Builder menjelaskan implementasi berjalan
5. Reviewer menjelaskan risiko
6. Founder memberi arahan lanjutan
7. Director memperbarui queue

Mode ini paling realistis untuk fase awal.

### Mode 2: Voice Layer

Setelah task engine dan chat stabil, dapat ditambahkan:

- TTS untuk laporan singkat
- STT untuk arahan founder
- voice briefing internal

Namun voice datang setelah colony state engine matang.

## Apakah Harus Memakai OpenClaw

Tidak harus.

Keputusan resmi yang direkomendasikan:

- bangun `JAGAT Colony` sebagai sistem internal sendiri
- perlakukan OpenClaw hanya sebagai kandidat shell atau worker runtime tambahan
- jangan menambatkan roadmap colony ke keberhasilan OpenClaw

Jika OpenClaw stabil, ia bisa dipakai untuk:

- remote agent shell
- lightweight multi-agent runner
- external command bridge

Jika tidak stabil, colony tetap berjalan lewat runtime internal JAGAT.

## Arsitektur Runtime yang Direkomendasikan

### Layer 1 - JAGAT Core

- identitas
- memory retrieval
- reasoning protocol
- decision policy
- founder doctrine

### Layer 2 - Colony Engine

- task queue
- agent registry
- scheduler
- approval logic
- reporting engine

### Layer 3 - Transport Layer

- web chat internal
- mobile notification
- telegram trigger
- future voice room

### Layer 4 - Worker Runtime

- local inference workers
- coding worker
- review worker
- memory worker
- reporting worker

## Rekomendasi Jalur Chat

Keputusan arsitektur yang direkomendasikan:

1. **Utama:** chat internal di UI JAGAT
2. **Sekunder:** Telegram untuk notif dan trigger
3. **Engineering only:** terminal

Alasannya:

- UI internal paling mudah dikontrol, diaudit, dan dihubungkan ke backlog/state
- Telegram bagus untuk akses cepat, tetapi rapuh untuk konteks panjang dan kerja berat
- terminal terlalu teknis untuk founder operating surface

## Kebutuhan Model Lokal

### Jawaban Singkat

Ya, model lokal pada akhirnya harus di-upgrade agar colony lebih cepat, lebih stabil, dan lebih dekat ke kualitas reasoning kelas atas.

Namun upgrade model bukan langkah pertama satu-satunya.

### Keputusan Realistis

Untuk fase awal:

- gunakan model lokal gratis yang ada untuk membangun framework kerja colony
- fokus dulu pada workflow, queue, state, boundary, dan monitoring
- jangan menunggu model sempurna untuk mulai membangun struktur kerja

Untuk fase menengah:

- upgrade model planner/reasoning
- pisahkan model cepat vs model mendalam
- siapkan migrasi ke infrastruktur target yang lebih kuat

### Prinsip Penting

Target "reasoning setara Claude Opus kelas atas" tidak dicapai hanya dengan mengganti satu model.

Itu harus datang dari kombinasi:

- protokol penalaran
- memory yang kaya dan terkurasi
- routing yang benar
- review loop
- benchmark internal
- model yang cukup kuat
- infrastruktur yang sanggup menjalankan semuanya 24/7

Dengan kata lain:

`kecerdasan sistem = model + memori + workflow + evaluasi + orkestrasi`

Bukan model saja.

## Rekomendasi Upgrade Model dan Infra

### Tahap Sekarang

Server staging Ryzen 5 3600 / 32GB RAM tetap dipakai untuk:

- membangun task engine
- membangun chat internal
- membangun monitoring
- menguji colony role
- menguji ritme kerja

### Tahap Berikutnya

Wajib disiapkan untuk runtime colony yang lebih serius:

- migrasi ke Linux/Proxmox pada server target
- peningkatan RAM dan stabilitas runtime
- GPU inference class enterprise
- pemisahan model cepat dan model reasoning

### Prinsip Deployment

- model kecil/cepat untuk reporting, routing, status, triage
- model lebih kuat untuk planning, coding, review, dan reasoning panjang
- jangan paksa satu model kecil menangani semua role colony

## Fase Implementasi Colony

### Colony Phase C1 - Operating Model Lock

Target:

- role colony resmi
- task lifecycle resmi
- founder control doctrine
- transport doctrine

Deliverable:

- dokumen ini
- keputusan tool/runtime awal

### Colony Phase C2 - Founder Command Center

Target:

- dashboard internal founder
- mission board
- task queue board
- approval and blocker panel

### Colony Phase C3 - Internal Chat Room

Target:

- founder dapat chat dengan colony
- colony dapat mengembalikan status by role
- transcript masuk ke state system

### Colony Phase C4 - Colony Task Engine

Target:

- queue resmi
- assignment per agent
- status update otomatis
- reporting loop

### Colony Phase C5 - Worker Execution

Target:

- planner, research, builder, reviewer, reporter benar-benar aktif
- coding flow dimulai dari queue, bukan prompt bebas

### Colony Phase C6 - 24/7 Scheduler

Target:

- audit harian
- laporan otomatis
- retry task gagal
- nightly review

### Colony Phase C7 - Voice / Meeting Layer

Target:

- founder briefing by voice
- TTS status room
- STT direction capture

## Definition of Done Awal untuk Colony

Colony dianggap hidup secara resmi jika:

1. founder bisa membuka command center
2. founder bisa membuat mission baru
3. planner bisa memecah mission menjadi task
4. task dapat berubah status dengan jejak audit
5. minimal satu worker bisa menjalankan task nyata
6. founder bisa menerima laporan progres tanpa prompting manual panjang

## Larangan Utama

- jangan jadikan Telegram sebagai pusat operasi colony
- jangan jadikan OpenClaw sebagai satu-satunya fondasi
- jangan mulai dari voice sebelum text workflow stabil
- jangan membiarkan agent bergerak tanpa boundary dan approval logic
- jangan mengukur kecerdasan hanya dari model base

## Keputusan Operasional Saat Ini

Keputusan awal yang direkomendasikan:

1. bangun colony internal sendiri
2. gunakan UI JAGAT sebagai command center utama
3. gunakan chat internal web sebagai workspace utama
4. gunakan Telegram hanya untuk trigger/notifikasi
5. terus gunakan model lokal gratis untuk membangun framework kerja lebih dulu
6. siapkan roadmap upgrade model dan infrastruktur untuk reasoning dan 24/7 runtime yang lebih kuat

## Next Step

Setelah dokumen ini disetujui, eksekusi dimulai dari:

1. definisi entity dan status task colony
2. desain UI founder command center
3. desain internal chat room colony
4. desain agent registry dan worker boundary
5. baru implementasi bertahap
