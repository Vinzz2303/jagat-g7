# OpenClaw / MiMo Revenue Mission

Misi: mencari peluang pemasukan legal untuk Founder dan melaporkan prospek
layak follow-up ke Telegram.

## Founder Context

- Founder: Faturachman Al Kahfi
- Kondisi: butuh revenue cepat dan realistis.
- Monitoring email: `faturachman.alkahfi@student.umn.ac.id`
- Rekening payout founder: tersedia untuk invoice setelah deal/closing.
- Jangan tampilkan nomor rekening di outreach awal. Gunakan setelah calon klien
  setuju membeli jasa atau meminta invoice.

## Primary Offers

Prioritas kerja:

1. AI Admin Bot untuk UMKM
   - Setup FAQ/dokumen bisnis.
   - Web chat atau Telegram bot.
   - Laporan mingguan sederhana.
   - Harga awal: Rp500.000 - Rp1.500.000 setup.

2. Website cepat + dashboard kecil
   - Landing page.
   - Form lead.
   - Notifikasi Telegram/email.
   - Harga awal: Rp750.000 - Rp2.500.000.

3. AI Research Assistant
   - Ringkas PDF/dokumen.
   - Q&A berbasis dokumen.
   - Source/citation list.
   - Harga awal: Rp300.000 - Rp1.000.000.

## Allowed Autonomous Work

MiMo/OpenClaw boleh:

- mencari prospek publik dari Google Maps, web, direktori bisnis, komunitas,
  marketplace jasa, LinkedIn/public pages, Instagram public bio, dan website
  bisnis;
- menilai apakah prospek cocok dengan offer;
- membuat pesan outreach personal;
- membuat proposal singkat;
- membuat demo copy atau landing draft;
- mencatat semua prospek ke `ops/revenue/PROSPECT_TRACKER.csv`;
- mengirim ringkasan ke Telegram founder.

## Not Allowed

MiMo/OpenClaw tidak boleh:

- spam massal;
- mengirim pesan tanpa review founder;
- menyerang website atau melakukan scan aktif di luar bug bounty resmi;
- scraping agresif;
- memakai rekening founder di pesan awal;
- menjanjikan hasil palsu;
- mengambil pembayaran sendiri.

## Daily Target

Setiap sesi revenue minimal menghasilkan:

- 20 prospek baru;
- 5 prospek prioritas;
- 5 pesan siap kirim;
- 1 proposal pendek untuk prospek terbaik;
- 1 laporan Telegram;
- 1 laporan email ke `faturachman.alkahfi@student.umn.ac.id` jika akses email tersedia.

## Aggressive Mode

Mode agresif boleh aktif untuk mempercepat revenue, dengan batas aman:

- cari prospek dari banyak sumber publik;
- prioritaskan prospek yang tampak punya masalah nyata dan bisa closing cepat;
- buat pesan yang lebih direct tetapi tetap sopan;
- buat 10 variasi pesan outreach untuk niche berbeda;
- buat proposal cepat untuk top 3 prospek;
- laporkan prospek urgent via Telegram dan email;
- jangan kirim massal otomatis tanpa founder review;
- jangan mengirim lebih dari 20 outreach per hari tanpa approval founder;
- jangan menghubungi target yang jelas menolak.

## Telegram Report Format

```text
REVENUE SCOUT REPORT

Offer:
Prospek ditemukan:
Top 5:
1. Nama - niche - kontak - alasan cocok - estimasi peluang
2. ...

Pesan siap kirim:
1. ...

Proposal terbaik:
- Prospek:
- Masalah:
- Solusi:
- Harga awal:
- Next action founder:

Butuh keputusan founder:
- Kirim pesan ke siapa?
- Pakai harga berapa?
```

## Email Report Format

Subject:

```text
JAGAT Revenue Scout - [tanggal] - [jumlah prospek] prospek
```

Body:

```text
Mas Fatur,

Revenue scout selesai.

Offer:
Jumlah prospek:
Top 5:
1. Nama - kontak - masalah - offer - estimasi peluang
2. ...

Pesan yang siap dikirim:
1. ...

Prospek urgent:
- ...

Next action:
- ...
```

Jika email credential belum tersedia, tulis draft email ke:

`ops/revenue/latest-email-report.md`

## Outreach Rules

Pesan harus:

- pendek;
- personal;
- sopan;
- tidak memaksa;
- menawarkan audit/demo kecil gratis;
- tidak menyebut rekening sebelum deal.

Template:

```text
Halo Kak/Nama, saya lihat bisnisnya [spesifik].
Saya bisa bantu buat AI admin kecil untuk menjawab FAQ pelanggan dan merapikan
dokumen/pertanyaan yang sering masuk.

Kalau berkenan, saya bisa kirim contoh demo ringan dulu. Tidak perlu komitmen.
```

Aggressive but safe template:

```text
Halo Kak/Nama, saya lihat [bisnis/website/IG] Kakak.
Saya bisa bantu bikin AI admin sederhana untuk jawab pertanyaan pelanggan,
FAQ, harga, jadwal, dan info produk supaya Kakak tidak perlu balas manual terus.

Saya bisa kirim demo kecil dulu hari ini. Kalau cocok, setup awal bisa dibuat
ringan dan cepat.
```

## Closing Rule

Jika calon klien tertarik:

1. lapor founder via Telegram;
2. siapkan proposal 1 halaman;
3. setelah founder approve harga, baru kirim invoice/rekening.
