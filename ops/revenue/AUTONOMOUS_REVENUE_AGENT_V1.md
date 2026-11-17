# JAGAT Autonomous Revenue Agent v1

Status: active baseline
Mode: discovery/drafts otomatis; email hanya diproses setelah approval exact founder per penerima dan hash

## Tujuan

Revenue Agent v1 membuat server bekerja rutin untuk menyiapkan bahan cari uang:

- mencari prospek baru dari direktori publik dengan rate limit kecil
- menjelajahi sumber secara bergilir memakai cursor per kategori/kota
- hanya memasukkan prospek baru yang punya email publik, kecuali mode phone fallback sengaja diaktifkan
- memilih prospek prioritas dari `PROSPECT_TRACKER.csv`
- memakai Gemini sebagai premium brain untuk menyusun brief harian
- membuat draft pesan yang bisa Mas Fatur review
- membuat approval inbox; worker terjadwal memproses approval valid satu pesan per siklus
- menyimpan laporan ke `ops/revenue/daily/`
- opsional mengirim ringkasan ke Telegram founder

## Batas Aman

- Tidak mengirim pesan ke calon klien tanpa approval exact founder; maksimal 1/cycle dan 5 percobaan/hari.
- Tidak blast WhatsApp/email/LinkedIn.
- Tidak menjanjikan omzet/profit pasti.
- Tidak meminta password atau data sensitif klien.
- Tidak mengubah tracker kecuali founder memberi hasil respons.
- Tidak melakukan bulk send; email dengan hasil `unknown` ditahan untuk rekonsiliasi.

## Command Manual

Generate report saja:

```powershell
node scripts/autonomous-revenue-agent-v1.mjs
```

Generate atau perbarui brief secara lokal tanpa memanggil Gemini atau Telegram:

```powershell
node scripts/autonomous-revenue-agent-v1.mjs --offline
```

Generate report dan kirim ringkasan ke Telegram founder:

```powershell
node scripts/autonomous-revenue-agent-v1.mjs --send-telegram
```

Jalankan siklus lengkap discovery + brief:

```powershell
npm run revenue:cycle
```

Kirim daftar 10 prospek terbaru ke Telegram founder (HTML di-escape, error kirim membuat exit code gagal):

```powershell
node scripts/show-prospects.mjs --count=10 --send-telegram
```

Jalankan discovery saja:

```powershell
npm run revenue:discover
```

Preview tanpa menulis file:

```powershell
node scripts/autonomous-revenue-agent-v1.mjs --dry-run
```

## Jadwal Otomatis

Installer scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-revenue-agent-schedule.ps1
```

Installer default: tiap 6 jam. Scheduled Task yang terpasang saat audit 2026-11-05 memakai interval 3 jam dan memanggil `scripts/run-autonomous-revenue-cycle-v1.ps1`.

Siklus terjadwal menjalankan discovery, revenue brief, email draft, lalu worker approval-only. Email hanya dikirim untuk approval founder yang cocok dengan penerima/hash draft saat ini; maksimum satu pesan per siklus dan lima attempt per hari. Kegagalan discovery, brief, atau draft melewati worker dan menghasilkan exit code nonzero.

Discovery sekarang berjalan email-only secara default. Kontak yang hanya punya nomor telepon dilewati agar follow-up bisa dilakukan lewat Gmail dan lebih mudah ditrack.

Discovery membatasi penelusuran hingga 12 halaman kategori per siklus (atau lebih sedikit jika `--max-scan` lebih kecil) dan berhenti sekitar 8 menit setelah mulai, setelah pemeriksaan halaman yang sedang berjalan selesai. Cursor sumber berlanjut pada siklus berikutnya, sehingga kategori kosong tidak membuat satu run menjelajahi seluruh 340 kombinasi.

Pada Windows, jika resolver MX Node mengembalikan `ECONNREFUSED` karena menunjuk `127.0.0.1`, discovery memakai `nslookup -type=mx` dengan argumen terpisah melalui DNS sistem. Domain tanpa MX tetap ditolak. Ini tidak mengubah konfigurasi DNS host.

Autonomous boundary:

```text
JAGAT BOLEH:
- menjelajahi direktori publik dengan rate limit;
- menyimpan cursor sumber agar tidak mengulang halaman yang sama;
- mencari email publik;
- memberi scoring prioritas;
- membuat draft email;
- membuat approval inbox;
- mengirim ringkasan ke Telegram founder.

JAGAT TIDAK BOLEH:
- mengirim email tanpa approval exact per penerima/hash;
- mengirim WhatsApp/LinkedIn DM otomatis;
- menjanjikan harga final tanpa approval;
- follow-up otomatis;
- memakai credential browser/Gmail untuk outbound tanpa approval gate resmi.
```

## Output

- `ops/revenue/latest-revenue-brief.md`
- `ops/revenue/latest-prospect-discovery.md`
- `ops/revenue/daily/REVENUE_BRIEF_YYYY-MM-DD_HHmm.md`
- `ops/revenue/EMAIL_DRAFTS_TODAY.md`
- `ops/revenue/OUTREACH_APPROVAL_INBOX.md`
- `ops/revenue/prospect-discovery-state.json`
- Telegram founder jika `--send-telegram` aktif

## Cara Eksekusi Founder

1. Baca Telegram brief.
2. Buka `ops/revenue/OUTREACH_APPROVAL_INBOX.md`.
3. Pilih 1-3 prospek yang layak.
4. Review pesan persis di `ops/revenue/EMAIL_DRAFTS_TODAY.md` dan `OUTREACH_APPROVAL_INBOX.md`.
5. Jika setuju, buat approval menggunakan `scripts/approve-outreach-draft.mjs`; siklus memproses satu approval.
6. Pantau status send/failed/unknown via Telegram dan catat balasan/opt-out.
7. Minta JAGAT membuat demo spesifik jika prospek membalas.

## Next Version

v2 baru boleh ditambah setelah v1 stabil:

- lead discovery dari sumber publik dengan rate limit
- scoring otomatis berdasarkan niche dan lokasi
- follow-up reminder 24/48 jam
- approval inbox untuk outbound
- integrasi Gmail/LinkedIn hanya setelah ada approval gate yang jelas
