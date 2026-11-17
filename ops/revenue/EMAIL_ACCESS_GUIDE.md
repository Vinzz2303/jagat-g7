# Revenue Email Access Guide

Tujuan: memberi OpenClaw/MiMo channel laporan email ke Founder tanpa
menaruh password utama di repo.

## Email Monitoring

Alamat Founder:

`faturachman.alkahfi@student.umn.ac.id`

Gunakan email ini untuk menerima:

- laporan prospek harian;
- prospek urgent;
- draft outreach siap kirim;
- proposal cepat;
- status follow-up.

## Jangan Simpan Password di Repo

Jangan tulis password email di:

- `.env`
- markdown repo
- chat publik
- Telegram message
- source code

Jika butuh SMTP, gunakan app password/OAuth/token yang bisa dicabut, bukan
password utama akun.

## Minimal Config Jika SMTP Tersedia

Simpan sebagai environment variable di runtime, bukan di repo:

```powershell
$env:REVENUE_EMAIL_TO="faturachman.alkahfi@student.umn.ac.id"
$env:REVENUE_EMAIL_FROM="faturachman.alkahfi@student.umn.ac.id"
$env:REVENUE_SMTP_HOST="smtp.gmail.com"
$env:REVENUE_SMTP_PORT="587"
$env:REVENUE_SMTP_USER="faturachman.alkahfi@student.umn.ac.id"
$env:REVENUE_SMTP_PASS="<app-password-or-token>"
```

Jika credential belum tersedia:

1. OpenClaw/MiMo tetap membuat draft report.
2. Simpan draft ke `ops/revenue/latest-email-report.md`.
3. Founder bisa copy/send manual.

## Email Safety Rules

- Email laporan ke Founder boleh otomatis.
- Email outreach ke calon klien harus founder-reviewed dulu.
- Jangan blast massal.
- Maksimal 20 outreach/hari tanpa approval tambahan.
- Stop follow-up jika calon klien menolak.

