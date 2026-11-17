# Email Outreach Agent v1

Status: active baseline
Mode: discovery otomatis + founder approval per pesan; tidak ada bulk send

## Fungsi

Agent ini membuat draft email personal untuk prospek prioritas dari `PROSPECT_TRACKER.csv`.

Output:

- `ops/revenue/EMAIL_DRAFTS_TODAY.md`
- ringkasan Telegram jika dijalankan dengan `--send-telegram`

## Command

```powershell
npm run revenue:email:drafts
```

Kirim ringkasan ke Telegram:

```powershell
npm run revenue:email:drafts:send
```

## Cara Review dan Approve

1. Review penerima, sumber, masalah, offer, subject, dan body di `ops/revenue/OUTREACH_APPROVAL_INBOX.md` serta `EMAIL_DRAFTS_TODAY.md`.
2. Jika setuju dengan pesan persis itu, jalankan `node scripts/approve-outreach-draft.mjs --to=<email> --hash=<draft-hash> --approved-by="Faturachman Al Kahfi" --expires-hours=24`.
3. Scheduled cycle memproses maksimal satu approval per siklus; untuk memproses sekarang, jalankan `node scripts/process-approved-outreach.mjs`.
4. Status sent/failed/unknown dikirim ke Telegram founder. Periksa balasan dan catat hasil pada tracker.

## Batas Aman

- Approval exact satu penerima/hash wajib sebelum sender berjalan.
- Maksimal 5 percobaan per hari dan satu pesan per siklus.
- Bulk send tetap diblokir oleh D-043.
- Jangan follow-up kurang dari 24 jam.
- Stop jika prospek menolak.
- Jangan kirim rekening atau klaim omzet naik di email pertama.

## Catatan

Pola email placeholder ditolak saat discovery, draft generation, approval, dan send.
Opt-out tercatat di `ops/revenue/SUPPRESSION_LIST.json`; jangan approve atau hubungi kembali alamat suppressed.
