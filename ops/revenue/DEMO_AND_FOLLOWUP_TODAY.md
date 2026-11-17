# Demo and Follow-up Today - 2026-06-08

Status: ready for manual outreach
Scope: AI Admin Bot UMKM + Website Cepat early revenue

## Safety Boundary

- Kirim manual satu per satu, jangan blast.
- Jangan klaim WhatsApp automation resmi jika belum pakai WhatsApp Cloud API.
- Jangan minta password client di chat.
- Jangan janji omzet naik, closing pasti, atau integrasi POS/payment penuh.
- Invoice, DP, payment confirmation, dan token activation tetap manual/admin-reviewed.

## Demo 1 - Mas Dikun

Target problem:

Mas Dikun adalah rumah makan legendaris. Kebutuhan paling cepat adalah website sederhana dan AI admin untuk menjawab menu, jam buka, lokasi, dan order.

Demo bot flow:

```text
Customer: Menu yang paling laris apa?
AI Admin: Menu favorit Mas Dikun adalah nasi uduk, ayam kampung goreng, dan lauk pendamping. Untuk pesanan hari ini, Kakak bisa pilih jumlah porsi dan jam ambil/antar.

Customer: Jam bukanya kapan?
AI Admin: Jam buka mengikuti operasional outlet. Jika Kakak mau, saya bisa bantu cek ketersediaan pesanan untuk hari ini dan teruskan ke admin.

Customer: Bisa pesan 10 porsi?
AI Admin: Bisa. Tolong kirim nama, jumlah porsi, pilihan menu, jam ambil/antar, dan nomor WhatsApp. Admin akan konfirmasi harga final dan ketersediaan.
```

Offer:

AI Admin Bot + Website Cepat, estimasi awal Rp750.000 - Rp1.500.000 setup untuk demo ringan.

Message to send:

```text
Halo Kak, saya lihat Mas Dikun sudah legendaris untuk nasi uduk dan ayam kampung goreng. Saya sedang bantu bisnis lokal bikin AI admin sederhana untuk jawab menu, jam buka, dan order awal supaya owner tidak perlu balas pertanyaan berulang terus.

Saya bisa kirim demo kecil hari ini: contoh chat pelanggan tanya menu, jam buka, dan pesanan 10 porsi. Kalau cocok, kita mulai dari paket ringan, bukan sistem mahal.
```

## Demo 2 - Custom Style

Target problem:

Tailor custom sering menerima pertanyaan repetitif tentang bahan, ukuran, estimasi harga, dan cara order.

Demo bot flow:

```text
Customer: Bisa jahit kemeja custom?
AI Admin: Bisa. Untuk estimasi awal, Kakak bisa kirim model referensi, ukuran, jenis bahan jika sudah ada, dan deadline pemakaian.

Customer: Harga mulai berapa?
AI Admin: Harga final tergantung bahan, model, dan detail jahitan. Saya bisa bantu kumpulkan kebutuhan dulu agar admin bisa memberi quote yang lebih cepat.

Customer: Cara ordernya gimana?
AI Admin: Kirim nama, model, ukuran, bahan, jumlah, dan deadline. Admin akan konfirmasi estimasi harga dan jadwal fitting.
```

Offer:

AI Admin Bot + Website Cepat, estimasi awal Rp750.000 - Rp1.500.000 setup.

Message to send:

```text
Halo Kak, saya lihat Custom Style melayani jahit custom. Saya bisa bantu bikin AI admin sederhana untuk jawab pertanyaan bahan, ukuran, estimasi harga, dan cara order, jadi calon pelanggan bisa diarahkan dulu sebelum admin balas manual.

Saya bisa kirim demo chat kecil hari ini untuk alur kemeja custom: tanya harga, bahan, ukuran, dan booking fitting. Kalau cocok, bisa mulai dari paket ringan.
```

## Demo 3 - Cleanforyou Express Laundry

Target problem:

Laundry butuh respon cepat untuk harga per kg, layanan antar-jemput, estimasi selesai, dan status cucian.

Demo bot flow:

```text
Customer: Harga laundry per kg berapa?
AI Admin: Saya bisa bantu cek paket laundry. Silakan pilih cuci setrika, setrika saja, atau express. Admin akan konfirmasi harga final sesuai lokasi dan berat cucian.

Customer: Bisa pickup?
AI Admin: Bisa jika area terjangkau. Tolong kirim alamat, jumlah perkiraan kg, dan jam pickup yang diinginkan.

Customer: Cucian saya sudah selesai?
AI Admin: Tolong kirim nama dan nomor order. Saya akan bantu teruskan ke admin untuk cek status.
```

Offer:

AI Admin Bot, estimasi awal Rp500.000 - Rp1.500.000 setup.

Message to send:

```text
Halo Kak, saya lihat Cleanforyou Express Laundry melayani laundry ekspres. Saya bisa bantu bikin AI admin sederhana untuk jawab pertanyaan harga, pickup, estimasi selesai, dan status cucian.

Saya bisa kirim demo kecil hari ini: pelanggan tanya harga per kg, minta pickup, dan cek status cucian. Ini masih paket ringan/manual dulu, bukan sistem mahal.
```

## Follow-up 24 Jam

```text
Halo Kak, saya follow-up demo AI admin yang kemarin. Kalau Kakak mau, saya bisa sesuaikan contoh bot-nya dengan menu/layanan asli bisnis Kakak, lalu kasih estimasi scope dan harga ringan.
```

## Follow-up 48 Jam

```text
Halo Kak, saya tutup follow-up dulu supaya tidak mengganggu. Kalau nanti Kakak ingin coba admin AI/website ringan untuk jawab pertanyaan pelanggan otomatis, saya bisa bantu mulai dari MVP kecil dulu.
```

## Jawaban Harga

```text
Untuk tahap awal, saya sarankan mulai dari MVP kecil:

- AI Admin Bot UMKM: Rp500.000 - Rp1.500.000 setup
- Website Cepat + Admin ringan: Rp750.000 - Rp2.500.000 setup

Harga final tergantung jumlah FAQ, halaman, dan alur order. Payment/invoice manual, dan kita sepakati scope dulu sebelum mulai.
```

## Jawaban "Mahal"

```text
Paham Kak. Kita bisa mulai dari versi paling ringan dulu: FAQ + alur inquiry dasar, tanpa integrasi berat. Tujuannya bukan langsung sistem besar, tapi demo kecil yang bisa membantu admin mengurangi pertanyaan berulang.
```

## Jawaban "Boleh Lihat Demo?"

```text
Boleh Kak. Saya kirim demo alur chat singkat dulu: pelanggan tanya layanan, harga, jam buka, dan cara order. Kalau dari demo itu terasa cocok, baru kita rapikan FAQ bisnis Kakak dan buat versi MVP-nya.
```

## Tracker Updates

Update `ops/revenue/PROSPECT_TRACKER.csv` untuk tiga prospek prioritas:

- `Mas Dikun` -> status `demo_ready`, follow-up due `2026-06-09`
- `Custom Style` -> status `demo_ready`, follow-up due `2026-06-09`
- `Cleanforyou Express Laundry` -> status `demo_ready`, follow-up due `2026-06-09`
