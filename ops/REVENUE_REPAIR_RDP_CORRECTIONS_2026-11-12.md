# Koreksi temuan audit RDP — 12 November 2026

## Perubahan
- Parser field website mengenali label persis `Website` dan `Website address`, termasuk link direktori `/redir/...?` yang dilaporkan. Label berawalan Sponsored dan link iklan umum tidak menjadi bukti situs resmi.
- Fixture menggunakan struktur HTML dalam laporan RDP dengan domain/ID sintetis. Tes mencakup iklan sebelum field resmi, field lama, sponsor-only, serta verifikasi sumber email.
- Kedua suite provenance dan notification memakai `pathToFileURL(preload).href` untuk argumen Node `--import`. Direktori tes mengandung spasi dan # agar URL encoding ikut diuji.

## Verifikasi koreksi
Lingkungan: Linux, Node v24.22.1, tanpa akses produksi.
- Syntax check ketiga file: PASS.
- Provenance: 67 assertions PASS.
- Notification: 31 assertions PASS.
- Revenue status: 25 checks PASS.
- Model provider JSON: 14 tests PASS.
- Aggregate offline belum PASS di executor ini: sender smoke terhenti karena dependency `dotenv` belum terpasang, bukan hasil uji pengiriman.
- Typecheck/build belum dapat dijalankan ulang: `tsc: not found`.
- Lint belum dapat dijalankan: `eslint: not found`.
- Windows asli belum diuji ulang. Hasil PASS build/typecheck dalam laporan RDP adalah sebelum koreksi ini.

## Langkah agen RDP
1. Ambil branch perbaikan terbaru ke salinan terisolasi. Pertahankan perubahan lokal dan jangan ubah checkout live.
2. Dengan dependency proyek tersedia, jalankan `npm run test:revenue-offline`, `npm run typecheck`, dan `npm run build` pada Windows.
3. Pastikan fixture provenance dan dua suite sebelumnya gagal sekarang lulus; kirim output hasil.
4. Jangan deploy/reload PM2, mengubah .env/policy, atau mengirim email nyata tanpa izin pengguna yang sesuai.

Tidak ada perubahan kredensial, konfigurasi produksi, main, RDP, atau layanan berjalan. Log operasional lama tidak ditulis ulang; catatan koreksi ini berdiri sendiri.
