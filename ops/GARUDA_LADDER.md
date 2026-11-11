# JAGAT Garuda Ladder

Tanggal: 2026-06-06
Status: draft operasional

## Tujuan

Garuda Ladder adalah klasifikasi internal untuk menilai kemampuan model/agent JAGAT.
Ini menggantikan istilah eksternal seperti Haiku/Sonnet/Opus/Mythos.

Tujuan utama:

- Menentukan model mana cocok untuk drafting, coding, review, atau arsitektur.
- Mencegah model kecil diberi tugas terlalu berat.
- Membuat kenaikan level berbasis benchmark, bukan asumsi.
- Menjaga identitas JAGAT sebagai sistem sendiri.

## Level Resmi

| Level | Nama | Peran | Kewenangan |
| --- | --- | --- | --- |
| L1 | Bara | Draft worker | Membuat draft, ringkasan, pesan outreach, FAQ, proposal ringan |
| L2 | Cakra | Coding worker | Membuat patch kecil/sedang, test awal, script utilitas |
| L3 | Wisesa | Reviewer | Review patch, cari risiko, cek instruksi, usulkan perbaikan |
| L4 | Garuda | Architect | Pecah task besar, desain arsitektur, urutkan milestone, mapping risiko |
| L5 | Garuda Inti | Sovereign core candidate | Reasoning panjang, memory-grounded, multi-agent coordination, self-correction |

## Kriteria Umum

### L1 Bara

Harus mampu:

- Menulis draft jelas dan personal.
- Merangkum file pendek.
- Membuat pesan follow-up.
- Tidak melakukan aksi keluar tanpa approval.

### L2 Cakra

Harus mampu:

- Membaca file sebelum patch.
- Membuat perubahan kecil yang scoped.
- Menulis atau menjalankan test dasar.
- Tidak mengubah interface besar tanpa proposal.

### L3 Wisesa

Harus mampu:

- Menemukan bug/risk di patch.
- Memeriksa auth, boundary, dan data flow.
- Memberi verdict: pass, needs changes, blocked.
- Membedakan masalah nyata dari gaya kode.

### L4 Garuda

Harus mampu:

- Membaca roadmap/backlog/log.
- Memecah pekerjaan besar menjadi task kecil.
- Menentukan dependency dan acceptance criteria.
- Menjaga arah JAGAT agar tidak menjadi chatbot generik.

### L5 Garuda Inti

Harus mampu:

- Menjaga konteks besar lintas dokumen.
- Menjawab berbasis memori dan citation.
- Mengkoordinasikan planner, builder, reviewer, reporter.
- Melakukan self-correction dengan audit trail.
- Menolak task berbahaya tanpa kehilangan tujuan founder.

## Status Model Saat Ini

| Model | Status Awal | Catatan |
| --- | --- | --- |
| `qwen2.5-coder:7b` Server B | Kandidat L1-L2 | Cepat untuk drafting/coding ringan |
| `qwen2.5-coder:14b` Server B | Kandidat L2-L3 | Lebih kuat, lebih lambat, belum default brain |
| Local `llama3` Server A | Baseline/fallback | Perlu sovereign prompt agar tidak drift |
| Codex/MiMo/frontier model | L3-L4 supervisor | Masih dibutuhkan untuk heavy coding/review |

## Benchmark Berikutnya

Script benchmark harus memakai nama:

`scripts/garuda-ladder-benchmark.mjs`

Output laporan:

`ops/GARUDA_LADDER_RESULTS.md`

Benchmark wajib menguji:

1. identity and project grounding,
2. coding patch plan,
3. risk review,
4. test writing,
5. revenue follow-up drafting,
6. instruction discipline,
7. refusal/safety boundary.

## Prinsip

JAGAT tidak mengejar nama level milik sistem lain. JAGAT membangun klasifikasi sendiri
berbasis kemampuan nyata, memori berdaulat, dan hasil kerja yang bisa diaudit.
