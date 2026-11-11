# HEARTBEAT.md — Colony Autonomous Heartbeat Checklist

## Setiap Heartbeat (setiap 2 jam)

1. **Quick Health Check** — Baca `ops/colony-autonomous-log.md`, cek status terakhir
2. **Build Check** — Jalankan `cd c:\JAGAT && npx tsc --noEmit` untuk cek apakah ada error baru
3. **Pending Tasks** — Jika ada task di log dengan status `pending`, eksekusi satu task
4. **Log** — Tulis hasil heartbeat di `ops/colony-autonomous-log.md`

## Rules

- Jangan lebih dari 1 task per heartbeat (hemat token)
- Jika build error → prioritas fix error dulu
- Jika semua bersih → lanjut program berikutnya sesuai prioritas di AGENTS.md
