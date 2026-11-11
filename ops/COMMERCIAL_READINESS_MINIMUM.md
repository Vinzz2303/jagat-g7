# JAGAT Commercial Readiness Minimum

Tanggal: 2026-06-06
Status: operating baseline for early revenue

## Tujuan

Dokumen ini mendefinisikan paket komersial minimum yang boleh dijual sekarang tanpa menunggu Phase 5 penuh.

Prinsip utama:

- Jual yang bisa dikirim dalam 3-7 hari.
- Jangan menjanjikan super intelligence penuh ke UMKM awal.
- Jangan menjual akses Colony internal.
- Jangan klaim automation/outbound yang belum aman.
- Payment dan invoice masih manual sampai usage metering dan payment gateway siap.

## Produk yang Bisa Dijual Sekarang

### Paket 1 - AI Admin Bot UMKM

Target:

- restoran,
- laundry,
- tailor,
- kursus,
- toko kecil,
- jasa lokal.

Masalah yang diselesaikan:

- owner capek jawab pertanyaan berulang,
- pelanggan sering tanya harga/jam buka/menu/status order,
- belum ada FAQ rapi,
- belum ada laporan sederhana.

Deliverable 3-5 hari:

- FAQ bisnis dirapikan menjadi knowledge base kecil,
- web chat atau Telegram bot sederhana,
- alur tanya jawab produk/harga/jam buka,
- template order/inquiry,
- laporan ringkas mingguan/manual,
- dokumentasi cara pakai 1 halaman.

Harga awal:

- Setup: Rp500.000 - Rp1.500.000
- Maintenance opsional: Rp150.000 - Rp500.000/bulan

Yang tidak dijanjikan:

- bukan WhatsApp bot resmi otomatis jika belum memakai WhatsApp Cloud API,
- bukan payment gateway,
- bukan integrasi POS penuh,
- bukan chatbot bebas tanpa batas,
- bukan garansi closing/penjualan naik.

### Paket 2 - Website Cepat + Admin Panel Ringan

Target:

- sekolah/kursus,
- restoran lokal,
- tailor,
- percetakan,
- event organizer,
- jasa profesional.

Masalah yang diselesaikan:

- bisnis belum punya website rapi,
- pelanggan tidak tahu layanan/harga/kontak,
- inquiry masih tercecer,
- butuh landing sederhana untuk dipercaya.

Deliverable 5-7 hari:

- landing page 1-3 section,
- profil bisnis,
- daftar layanan,
- CTA WhatsApp/email,
- form lead sederhana,
- admin panel ringan atau sheet-based tracker,
- deployment ke hosting yang disepakati.

Harga awal:

- Rp750.000 - Rp2.500.000 setup
- Maintenance opsional: Rp200.000 - Rp500.000/bulan

Yang tidak dijanjikan:

- bukan marketplace penuh,
- bukan SEO ranking guaranteed,
- bukan sistem inventory kompleks,
- bukan desain enterprise custom tanpa scope tambahan.

### Paket 3 - Sovereign Research Assistant

Target:

- mahasiswa,
- dosen,
- komunitas riset/trading/crypto/saham,
- konsultan kecil,
- tim internal kecil.

Masalah yang diselesaikan:

- dokumen panjang sulit dibaca,
- catatan riset tercecer,
- butuh Q&A dokumen dengan sumber,
- butuh ringkasan dan action items.

Deliverable 3-7 hari:

- workspace upload dokumen kecil,
- ringkasan PDF/MD/TXT,
- Q&A dokumen,
- citation/source list,
- export ringkasan,
- panduan penggunaan.

Harga awal:

- Rp300.000 - Rp1.000.000 per project kecil
- Rp150.000 - Rp500.000/bulan untuk workspace ringan

Yang tidak dijanjikan:

- bukan legal/financial final advice,
- bukan data real-time guaranteed,
- bukan unlimited document ingestion,
- bukan menggantikan ahli domain.

### Paket 4 - Internal Command Center / Colony-lite

Target:

- founder kecil,
- agency,
- komunitas,
- tim proyek kecil,
- bisnis yang butuh task/reporting sederhana.

Masalah yang diselesaikan:

- pekerjaan tidak tercatat,
- follow-up hilang,
- laporan manual,
- tidak ada task queue/audit ringan.

Deliverable 5-7 hari:

- task board sederhana,
- status queued/running/done/blocked,
- daily/weekly report template,
- basic approval checklist,
- internal chat/report notes,
- runbook operasional.

Harga awal:

- Rp1.500.000 - Rp5.000.000 setup
- Maintenance opsional: Rp300.000 - Rp1.000.000/bulan

Yang tidak dijanjikan:

- bukan JAGAT Colony internal penuh,
- bukan autonomous coding worker,
- bukan akses ke rahasia dapur JAGAT,
- bukan sistem enterprise tanpa discovery lanjutan.

## Delivery Scope 3-7 Hari

### Hari 0 - Intake

- Pilih paket.
- Kumpulkan data bisnis.
- Set scope dan harga final.
- Terima DP jika disepakati.

### Hari 1-2 - Struktur

- Rapikan FAQ/dokumen.
- Buat flow utama.
- Buat draft UI/bot/landing.

### Hari 3-5 - Build

- Implement MVP.
- Isi konten awal.
- Test manual.
- Kirim demo.

### Hari 6-7 - Revisi Ringan

- 1x revisi scope kecil.
- Handover.
- Dokumentasi cara pakai.

## Payment and Invoice Flow Manual

Sampai Phase 5 payment gateway selesai, flow resmi adalah manual:

1. Founder/client setuju scope dan harga.
2. Buat invoice sederhana.
3. DP opsional 50% untuk pekerjaan di atas Rp1.000.000.
4. Pelunasan setelah demo/handover.
5. Catat transaksi di tracker manual.
6. Jangan memasukkan rekening di outreach awal.

Template invoice minimum:

```text
Invoice: JAGAT-[YYYYMMDD]-[CLIENT]
Client:
Package:
Scope:
Price:
DP:
Due:
Payment method:
Notes:
```

## Sales Boundary

Allowed:

- outreach manual ke kontak bisnis publik,
- pesan personal dan sopan,
- demo ringan,
- proposal paket hemat,
- follow-up 24/48 jam.

Disallowed:

- auto-send massal WhatsApp/email,
- klaim palsu sudah punya klien besar,
- menjamin omzet naik,
- mengambil credential client tanpa alasan dan prosedur aman,
- hacking/testing website client tanpa scope tertulis,
- menyimpan password di Markdown/CSV/chat.

## Legal and Risk Boundary

### WhatsApp

- Gunakan manual outreach dulu.
- Jangan blast.
- Jika perlu otomatisasi, gunakan WhatsApp Business Cloud API resmi.

### Email

- Pakai akun outreach khusus.
- Jangan pakai password utama.
- Gunakan app password/OAuth jika automation dibutuhkan.
- Draft boleh dibuat agent, pengiriman tetap founder-reviewed.

### Data Client

- Simpan hanya data yang diperlukan untuk delivery.
- Jangan minta password jika cukup pakai invite/access terbatas.
- Jangan gunakan data client untuk training tanpa izin.

### Financial/Investment Content

- Wajib disclaimer bukan nasihat keuangan.
- Jangan memberi instruksi beli/jual pasti.
- Jangan menjanjikan profit.

## Minimum Client-Facing Positioning

Versi singkat:

```text
JAGAT AI membantu bisnis kecil membuat admin AI, website sederhana, dan workspace riset berbasis dokumen agar pekerjaan harian lebih rapi dan cepat.
```

Versi founder:

```text
Saya Faturachman Al Kahfi, founder JAGAT AI. Saya membangun sistem AI karya anak bangsa untuk membantu bisnis kecil punya admin digital, website rapi, dan workflow yang lebih otomatis tanpa harus langsung membayar sistem mahal.
```

Versi batas aman:

```text
Untuk tahap awal, saya tawarkan MVP kecil yang bisa dites dulu. Jika cocok, baru kita lanjutkan ke integrasi lebih lengkap.
```

## Revenue Tracker Fields

Setiap prospek harus dicatat dengan:

- date,
- status,
- niche,
- company_or_person,
- public_contact,
- source,
- problem_hypothesis,
- offer,
- recommended_message,
- next_action,
- quoted_price,
- response,
- follow_up_due,
- notes.

## Close Criteria

Satu lead dianggap `qualified` jika:

- kontak valid,
- kebutuhan jelas,
- calon client menjawab,
- mereka bersedia melihat demo atau berdiskusi scope.

Satu deal dianggap `closed_won` jika:

- scope disepakati,
- harga disepakati,
- payment/DP diterima atau ada bukti komitmen tertulis.

## Next Implementation

1. Done: public pricing request now creates manual invoice requests via `/api/commercial/requests`.
2. Done: admin can review manual commercial requests in `/g7-admin`.
3. Done: admin can update request status and generate/copy Markdown invoice drafts in `/g7-admin`.
4. Done: persistent usage ledger tracks request units for manual metering without raw payload storage.
5. Done: `ops/revenue/DEMO_AND_FOLLOWUP_TODAY.md` for Mas Dikun, Custom Style, and Cleanforyou.
6. Done: `quoted_price`, `response`, dan `follow_up_due` fields added to prospect tracker.
7. Kirim 3 demo manual dan catat `response`.
8. Buat satu demo static UI untuk AI Admin Bot UMKM jika diperlukan setelah ada respons.
9. Setelah 3-5 transaksi manual, baru desain payment gateway production.

## Decision

Commercial readiness minimum aktif untuk early revenue, tetapi Phase 5 penuh tetap belum selesai. Semua penjualan awal harus diperlakukan sebagai MVP/service delivery manual, bukan SaaS self-serve production.
