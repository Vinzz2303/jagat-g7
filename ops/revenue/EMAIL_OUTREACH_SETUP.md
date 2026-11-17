# Email Outreach Setup - Safe Credential Pattern

Tanggal: 2026-06-06

## Status

Founder menyiapkan akun email khusus outreach.

Credential asli tidak boleh disimpan di repo, Telegram, OpenClaw config, log, atau file Markdown.

## Aturan Aman

- Jangan gunakan password utama email untuk automation.
- Gunakan app password atau OAuth token khusus.
- Jika password utama pernah diketik di chat/log, segera ganti password.
- Batasi pengiriman awal: maksimal 5 email manual/hari.
- OpenClaw/MiMo boleh membuat draft, tetapi tidak boleh mengirim massal tanpa review founder.

## Setup Gmail yang Disarankan

1. Login ke akun email outreach.
2. Aktifkan 2-Step Verification.
3. Buat App Password khusus:
   - App name: `JAGAT Outreach`
   - Simpan hanya di local secret manager atau environment variable.
4. Jangan commit app password ke git.

## Environment Variable Placeholder

Gunakan placeholder berikut jika nanti ada service email resmi:

```powershell
$env:JAGAT_OUTREACH_EMAIL="your-outreach-email@example.com"
$env:JAGAT_OUTREACH_APP_PASSWORD="paste-app-password-here"
```

## Allowed Agent Behavior

OpenClaw/MiMo boleh:

- Membuat subject email.
- Membuat draft email personal.
- Membuat follow-up 24/48 jam.
- Mencatat status prospect.

OpenClaw/MiMo tidak boleh:

- Mengirim email otomatis massal.
- Menyimpan password asli.
- Menaruh credential di Markdown/CSV/log.
- Mengirim rekening di outreach awal.

## Prompt Aman untuk Telegram

```text
Email outreach mode.

Gunakan akun email outreach khusus, tetapi jangan minta atau simpan password asli.
Tugas kamu hanya buat draft email personal untuk 3 prospek dari SEND_TODAY.md.
Jangan kirim otomatis.
Simpan draft ke ops/revenue/EMAIL_DRAFTS_TODAY.md.
```
