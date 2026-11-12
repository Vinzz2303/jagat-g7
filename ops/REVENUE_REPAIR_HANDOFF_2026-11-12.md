# Handoff perbaikan revenue JAGAT

Tanggal: 12 November 2026.
Branch: `fix/revenue-pipeline-reliability-2026-11-12`.
Basis: `1bb6eeb06a1be1cbdfbe5144ee593f5f63ec0f75`.

## Yang diubah

1. Pencarian prospek menyimpan bukti halaman tempat email benar-benar ditemukan. Hanya alamat yang cocok dengan domain situs resmi dan ditemukan pada halaman yang valid mendapat label `official_site:`. Kontak direktori tidak otomatis dianggap terverifikasi.
2. Pemilihan draft dan pengirim menggunakan pemeriksaan D-052 yang sama. Penolakan/STOP, suppression, duplikasi, riwayat percobaan pengiriman, batas kampanye dan persetujuan manual tetap berlaku. Data lama tidak otomatis dilabel ulang.
3. Kegagalan notifikasi Telegram opsional dicatat terpisah dari keberhasilan membuat brief/draft. Status pengiriman ambigu tidak dicoba ulang secara otomatis. Kegagalan proses utama tetap memblokir pengiriman.
4. Model Groq yang pensiun diganti dengan `llama-3.1-8b-instant`. JSON mode Gemini/Ollama diperbaiki, respons divalidasi dan timeout dibatasi. Respons rusak tidak diteruskan menjadi intent yang dapat dieksekusi. Larangan shell dari keluaran model dipertahankan.
5. Tes offline sintetis ditambahkan untuk provenance, notifikasi, status, sender dengan SMTP palsu, dan respons model.

## Verifikasi

Kode dalam branch ini cocok dengan paket patch yang telah diuji secara lokal. Typecheck, build, 48 assertion provenance, 31 assertion notifikasi, 25 pemeriksaan status, 14 tes model dan smoke test SMTP palsu lulus pada tahap pembuatan patch. Lint terblokir karena ESLint tidak tersedia. Lihat `ops/REVENUE_REPAIR_VALIDATION_2026-11-12.md` untuk laporan lengkap dan batas pengujian.

## Untuk agen di RDP

- Tinjau seluruh diff branch terhadap basis di atas sebelum menerapkan. Periksa perubahan lokal dan backup; jangan menimpa pekerjaan yang belum disimpan.
- Jangan mengganti konfigurasi produksi, policy kampanye, kredensial, tracker, suppression atau template privat dengan data contoh.
- Setelah perubahan ditinjau dan penerapan diizinkan, validasi pada salinan terisolasi dengan `npm run typecheck`, `npm run build`, dan `npm run test:revenue-offline`.
- Jangan menjalankan siklus outreach/send sebagai tes offline. Deployment, restart, pengujian provider berbayar dan pengiriman nyata memerlukan izin terpisah.
- Kredit Gemini habis tidak dapat diperbaiki oleh patch. Status provider, penjadwalan Windows, markup situs nyata dan pengiriman sungguhan belum diverifikasi.

## Batas publikasi

Commit ini hanya mempublikasikan kode, tes dan dokumentasi perbaikan. Log operasional lama tidak diperbarui. Tidak ada akses RDP, pengiriman email/Telegram, deployment, merge ke main atau rotasi kredensial yang dilakukan. Kredensial yang pernah terpapar tetap harus ditangani terpisah sebelum penggunaan tanpa pengawasan.
