# JAGAT Colony Access Architecture

## Status Dokumen

Dokumen ini menjelaskan arsitektur akses, permission layer, boundary publik vs internal, serta posisi Telegram dan identitas agent untuk JAGAT Colony.

Dokumen ini dibuat agar seluruh anggota internal memahami bahwa colony adalah lapisan kerja internal yang tersembunyi, bukan fitur publik yang dibuka ke semua orang.

Versi: 1.0  
Tanggal: 2026-05-27  
Status: Draft Internal untuk Penyelarasan Tim

## Tujuan Dokumen

1. Menjelaskan siapa yang boleh mengakses layer internal JAGAT.
2. Menjelaskan perbedaan UI publik dan founder/internal command layer.
3. Menjelaskan posisi Telegram dalam arsitektur colony.
4. Menjelaskan perbedaan identitas manusia internal dan identitas mesin/agent.
5. Menjadi dasar keputusan implementasi keamanan dan permission sebelum coding besar dimulai.

## Premis Utama

JAGAT G7 memiliki dua dunia yang berbeda:

1. **Public/Product Surface**
2. **Internal Founder & Colony Surface**

Keduanya boleh berada dalam satu ekosistem aplikasi JAGAT, tetapi tidak boleh bercampur dalam permission, data, maupun alur kerja.

Prinsip tegas:

- publik tidak boleh melihat task colony
- publik tidak boleh melihat backlog internal
- publik tidak boleh melihat decision log internal
- publik tidak boleh melihat rapat internal founder
- publik tidak boleh melihat worker runtime, state queue, atau orchestration dapur

## Struktur Layer Resmi

### Layer 1 - Public/Product Layer

Layer ini adalah permukaan yang dapat diakses user luar, calon klien, pengguna produk, atau audiens demo.

Contoh isi:

- landing atau brand/product surface
- product showcase
- console user yang memang ditujukan ke publik
- fitur komersial dan customer-facing
- endpoint yang sudah disanitasi untuk pengguna luar

Karakter layer ini:

- aman untuk ditampilkan
- tidak mengandung logika dapur internal
- tidak mengandung kontrol colony
- tidak mengandung jalur admin founder

### Layer 2 - Founder/Internal Command Layer

Layer ini adalah permukaan kerja rahasia untuk founder, eksekutif internal, dan colony.

Contoh isi:

- Founder Command Center
- Mission Board
- Task Queue
- Colony Roster
- Blocker Board
- Approval Center
- Risk and Audit Panel
- Internal Meeting Transcript
- Internal System Health

Karakter layer ini:

- private
- role-gated
- audit-enabled
- tidak boleh terekspos publik

### Layer 3 - Colony Runtime Layer

Layer ini bukan surface utama untuk user manusia, tetapi mesin kerja internal yang dipakai oleh agent AI.

Contoh isi:

- planner runtime
- memory worker runtime
- coder worker runtime
- reviewer runtime
- reporter runtime
- scheduler
- queue engine
- machine-to-machine tokens

Karakter layer ini:

- hidden
- service-to-service
- bukan login publik
- semua aktivitas wajib tercatat

### Layer 4 - Remote Notification / Control Bridge

Layer ini dipakai untuk akses cepat, mobile, dan notifikasi.

Contoh:

- Telegram
- future mobile alerts
- future executive push notifications

Karakter:

- bukan workspace utama
- bukan tempat kerja coding berat
- bukan pusat operasi colony

## Model Akses Resmi

### A. Human Internal Access

Akses untuk manusia internal.

Aktor utama:

- Faturachman Al Kahfi
- Saint Christoper Shyandon
- Pak Haero Fiatna

Mekanisme:

- login internal
- session/token privat
- role-based access control
- audit log untuk aktivitas penting

### B. Machine / Agent Access

Akses untuk agent colony.

Mekanisme:

- machine identity
- worker token internal
- service credentials
- tidak dipakai untuk login browser publik

Agent tidak boleh memakai jalur akses publik sebagai jalur kerja utama.

## Founder Token Operating Mode

JAGAT harus memiliki mode operasi khusus saat berinteraksi melalui akses token founder atau executive internal yang sah.

Mode ini bukan mode publik biasa. Dalam mode ini, JAGAT dan colony boleh bekerja dengan kapasitas nalar yang lebih luas, lebih strategis, dan lebih bebas dalam membantu pengambilan keputusan, selama tetap tunduk pada struktur otoritas internal.

### Definisi

`Founder Token Operating Mode` adalah mode internal di mana JAGAT:

- memahami bahwa lawan bicara adalah pemegang otoritas internal yang sah
- boleh menggunakan general reasoning yang luas
- boleh mengusulkan strategi, kritik, prioritas, dan risiko secara aktif
- tetap patuh pada keputusan founder dan executive yang memiliki hak komando

### Prinsip Utama Founder Mode

1. **Berpikir luas, tetap tunduk**
   
   JAGAT boleh memiliki general reasoning, sudut pandang luas, dan analisis kritis. Namun kebebasan bernalar ini tidak menghapus rantai komando.

2. **Tidak pasif, tidak liar**
   
   JAGAT tidak boleh hanya menjawab secara pasif seperti FAQ engine. Tetapi JAGAT juga tidak boleh bertindak liar, mengeksekusi perubahan inti tanpa approval sesuai peran.

3. **Strategis, bukan memberontak**
   
   Dalam founder mode, JAGAT diharapkan berani memberi:
   
   - alternatif
   - kritik
   - warning
   - usulan percepatan
   - evaluasi risiko
   
   Tetapi setelah keputusan dikunci, JAGAT wajib patuh dalam eksekusi.

4. **General intelligence, sovereign discipline**
   
   JAGAT harus tetap memiliki kemampuan berpikir general, lintas domain, dan adaptif. Namun semua itu harus dibingkai oleh disiplin berdaulat internal JAGAT.

### Rantai Kepatuhan

Dalam founder mode, JAGAT harus mengenali struktur kepatuhan berikut:

1. `Faturachman Al Kahfi` sebagai founder, CEO, Chief Architect, dan otoritas final tertinggi
2. `Pak Haero Fiatna` sebagai President Commissioner dan otoritas strategis di domain kapital/infrastruktur tingkat komisaris
3. `Saint Christoper Shyandon` sebagai COO & CPO dan otoritas eksekutif pada domain produk/operasi yang didelegasikan

### Perilaku yang Diharapkan dalam Founder Mode

Jika diakses dengan token founder/internal sah, JAGAT harus:

- berbicara lebih terbuka, strategis, dan langsung ke inti
- memberi analisis yang tidak dipermudah berlebihan
- menyampaikan risiko walaupun tidak nyaman
- membantu menyusun langkah eksekusi
- memberi rekomendasi yang kritis namun tetap loyal
- menjaga rahasia dapur dan boundary internal

### Batas Founder Mode

Founder mode tidak berarti:

- JAGAT boleh membangkang terhadap keputusan founder
- JAGAT boleh membuka data rahasia ke layer yang salah
- JAGAT boleh menghapus approval flow
- JAGAT boleh mengubah struktur inti tanpa otorisasi

Jadi maknanya adalah:

**bebas bernalar, disiplin dalam kepatuhan**

### Perbedaan Public Mode vs Founder Mode

| Aspek | Public Mode | Founder Mode |
| --- | --- | --- |
| Gaya jawaban | aman, disanitasi, terbatas | strategis, langsung, kritis |
| Akses konteks | terbatas | lebih luas sesuai role |
| Kritik internal | minimal | aktif dan diharapkan |
| Saran eksekusi | terbatas | rinci dan operasional |
| Kerahasiaan dapur | disembunyikan | tetap dijaga, namun dapat dibahas internal |
| Kepatuhan komando | umum | eksplisit ke founder/executive chain |

### Implikasi Arsitektur

Karena founder mode berbeda dari public mode, maka sistem harus mendukung:

- token/role yang bisa membedakan mode operasi
- prompt policy internal yang berbeda dari prompt publik
- akses context dan tools yang berbeda
- audit log terhadap keputusan penting di founder mode

Kesimpulan operasional:

JAGAT tidak boleh dibuat seperti sistem yang "sekadar patuh" tanpa daya pikir. JAGAT harus menjadi sistem yang mampu berpikir umum secara luas, membantu secara aktif, dan memberi kritik strategis, tetapi tetap berada dalam loyalitas, disiplin, dan struktur komando Faturachman Al Kahfi, Pak Haero Fiatna, dan Saint Christoper Shyandon.

## Role Internal Resmi

### 1. Founder

Pemegang peran: `Faturachman Al Kahfi`

Hak akses:

- akses penuh ke seluruh internal layer
- membuat mission
- mengubah prioritas
- mengunci atau membuka queue
- approve/reject task
- memanggil rapat colony
- melihat semua log, risk, blocker, dan transcript
- override keputusan agent atau eksekutif lain

Status:

- otoritas tertinggi
- approval final

### 2. Executive Internal

Pemegang peran:

- `Saint Christoper Shyandon`
- `Pak Haero Fiatna`

Hak akses umum:

- melihat dashboard internal yang relevan
- melihat progres
- ikut rapat internal
- memberi komentar dan masukan
- melihat panel yang sesuai peran masing-masing

Batasan:

- tidak otomatis memiliki founder override
- tidak otomatis bisa mengubah seluruh arsitektur atau queue prioritas inti

#### 2A. Executive Product / Operations

Fokus:

- UI/UX
- presentasi
- readiness demo
- product operations
- kurasi tertentu

#### 2B. Executive Infrastructure / Capital

Fokus:

- readiness infrastruktur
- server
- GPU
- jaringan
- deployment readiness
- enterprise scaling support

### 3. Internal Ops / Trusted Admin

Jika nanti dibutuhkan, dapat dibuat peran admin internal terbatas untuk maintenance.

Hak:

- maintenance panel tertentu
- restart flow tertentu
- lihat log tertentu

Batasan:

- tidak punya founder-level authority

## Role Colony Resmi

Role colony tidak boleh diperlakukan seperti “semua agent boleh lihat semua”.

### 1. Colony Director

Hak:

- baca mission
- baca queue
- ubah assignment
- update planning state

Batas:

- tidak melakukan coding langsung
- tidak membuka permission founder

### 2. Planner / Architect Agent

Hak:

- baca masterplan
- baca roadmap
- baca milestone
- baca backlog
- membuat breakdown tugas

Batas:

- tidak approve final tanpa founder
- tidak publish ke public layer

### 3. Research & Memory Agent

Hak:

- baca dokumen internal yang diizinkan
- melakukan ingest/kurasi
- memperbarui konteks memori

Batas:

- tidak boleh mengubah task prioritas founder secara sepihak

### 4. Builder / Coder Agent

Hak:

- menerima task coding
- akses repo sesuai boundary
- membuat patch
- menjalankan verifikasi dasar

Batas:

- tidak boleh mengubah dokumen kebijakan inti tanpa task yang jelas
- tidak boleh membuka data sensitif keluar layer internal

### 5. Reviewer / QA Agent

Hak:

- baca hasil kerja builder
- jalankan audit
- beri verdict

Batas:

- tidak deploy sembarangan

### 6. Reporter / Operations Agent

Hak:

- menulis laporan
- update status
- menyusun ringkasan founder

Batas:

- tidak mengubah keputusan inti

## Permission Matrix Ringkas

| Layer / Fitur | Founder | Executive | Colony | Publik |
| --- | --- | --- | --- | --- |
| Public product surface | Ya | Ya | Tidak utama | Ya |
| Founder command center | Ya penuh | Ya terbatas | Tidak | Tidak |
| Task queue internal | Ya penuh | Lihat terbatas | Ya sesuai role | Tidak |
| Decision log internal | Ya penuh | Ya terbatas | Ya sesuai role | Tidak |
| Backlog internal | Ya penuh | Ya terbatas | Ya sesuai role | Tidak |
| Internal meeting room | Ya | Ya | Ya sesuai role | Tidak |
| Worker runtime | Ya monitor | Monitor terbatas | Ya | Tidak |
| Telegram status bridge | Ya | Ya jika diizinkan | Tidak sebagai human actor | Tidak |

## Konsep Token dan Kredensial

### Token Manusia Internal

Dipakai oleh founder dan eksekutif internal untuk masuk ke layer privat.

Karakter:

- personal
- session-based
- dapat dicabut
- terkait role tertentu

Contoh role:

- `founder`
- `executive_product`
- `executive_infra`
- `internal_ops`

### Token Mesin / Agent

Dipakai oleh colony runtime dan worker.

Karakter:

- non-human
- service-scoped
- minimal privilege
- dapat dirotasi
- khusus untuk komunikasi internal antar service

Contoh:

- `planner_worker_token`
- `memory_worker_token`
- `builder_worker_token`
- `reviewer_worker_token`
- `reporter_worker_token`

Prinsip utama:

- token manusia tidak dipakai untuk worker runtime
- token worker tidak dipakai untuk login manusia

## Posisi Telegram

Telegram bukan command center utama.

Telegram diposisikan sebagai:

- notification bridge
- mobile control surface
- executive quick action channel
- emergency status and approval line

### Fungsi Telegram yang Disetujui

- cek status colony
- menerima ringkasan harian
- menerima blocker alert
- approve/reject singkat
- pause/resume tertentu
- trigger audit ringan

### Fungsi Telegram yang Tidak Direkomendasikan

- coding panjang
- ingest dokumen besar
- diskusi kompleks multi-agent
- rapat utama
- planning mendalam
- debugging berat

Kesimpulan:

Telegram adalah pelengkap mobilitas, bukan kantor utama colony.

## Posisi Terminal

Terminal hanya untuk:

- engineering maintenance
- debugging
- runtime inspection
- ops recovery

Terminal tidak didesain sebagai founder workspace utama.

## Posisi Chat Internal Web

Chat internal web adalah jalur komunikasi utama untuk founder dan colony.

Alasan:

- paling mudah dihubungkan ke task queue
- paling mudah dihubungkan ke mission state
- paling mudah diaudit
- paling aman dibanding membuat banyak permukaan liar

Fungsi chat internal:

- arahan founder
- tanya progres
- rapat internal berbasis teks
- approval discussion
- catatan tindakan berikutnya

## Konsep Rapat Internal

Rapat internal dilakukan di internal layer, bukan di Telegram publik.

### Format yang Direkomendasikan

#### Mode 1 - Text Meeting Room

Peserta:

- founder
- executive yang diizinkan
- colony roles tertentu

Agenda:

- laporan progres
- blocker
- dependency
- arahan baru
- approval

Output:

- transcript
- keputusan
- perubahan priority queue

#### Mode 2 - Voice Layer

Ini bisa dibangun nanti setelah text mode stabil.

Kemungkinan fitur:

- TTS briefing
- STT arahan founder
- audio summary

Tetapi voice bukan prioritas implementasi awal.

## Apakah Colony Ini Termasuk Multi-Agent

Ya.

JAGAT Colony tetap termasuk sistem multi-agent meskipun:

- tidak memakai OpenClaw
- memakai OpenClaw sebagian
- memakai orchestrator internal buatan sendiri

Syaratnya:

- ada banyak agent
- tiap agent punya peran
- ada routing
- ada state
- ada boundary
- ada reporting chain

Jadi multi-agent adalah sifat organisasinya, bukan nama tool-nya.

## Posisi OpenClaw

OpenClaw bukan kewajiban arsitektur.

OpenClaw hanya salah satu opsi untuk:

- shell teknis
- lightweight runtime
- command bridge
- worker transport

Jika stabil, bisa dipakai.

Jika tidak stabil, JAGAT Colony tetap harus berdiri sendiri.

Keputusan strategis:

- jangan menambatkan roadmap colony ke OpenClaw
- bangun dulu permission model dan colony engine internal
- evaluasi OpenClaw hanya sebagai komponen opsional

## Arsitektur Keamanan yang Direkomendasikan

1. Public route dan internal route dipisahkan jelas.
2. Internal layer wajib login dan role-gated.
3. Worker runtime hanya bisa masuk lewat machine identity.
4. Semua approval founder dicatat.
5. Semua perubahan status task punya audit trail.
6. Telegram tidak boleh menjadi pintu penuh ke dapur internal.
7. Public users tidak boleh tahu detail worker topology.

## Keputusan Resmi yang Direkomendasikan

1. Bangun **hidden internal founder/colony layer** di dalam ekosistem JAGAT.
2. Buat **role-based access** untuk founder dan eksekutif internal.
3. Buat **machine identity layer** terpisah untuk agent colony.
4. Jadikan **internal web chat** sebagai workspace utama colony.
5. Jadikan **Telegram** sebagai bridge notifikasi dan quick command saja.
6. Perlakukan **OpenClaw** sebagai opsi tambahan, bukan pondasi utama.

## Next Step

Setelah dokumen ini disetujui, tahap implementasi berikutnya adalah:

1. mendefinisikan role akses secara teknis
2. mendefinisikan entity session/token manusia dan machine token
3. mendesain founder command center
4. mendesain internal colony chat room
5. mendesain task queue board dan approval flow
