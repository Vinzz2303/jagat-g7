# Mas Christoper Coding Assist Pilot Procedure

Status: internal closed pilot
Owner: Founder / operator
Tooling: VSCode Remote SSH + terminal CLI

## Tujuan

Mas Chris bisa ujicoba JAGAT sebagai teman coding read-only: menjelaskan file, review risiko, membuat rencana patch, dan menyarankan test. Jalur ini belum memberi hak auto-edit, auto-apply patch, deploy, akses secret, atau akses founder mode.

## Arsitektur Akses

Rekomendasi pilot:

1. Mas Chris memakai laptop sendiri.
2. Mas Chris membuka repo `c:\JAGAT` lewat VSCode Remote SSH ke server/operator machine.
3. Mas Chris menjalankan CLI dari terminal VSCode.
4. CLI membaca konteks file yang aman, lalu mengirim prompt ke JAGAT BFF lokal di `http://127.0.0.1:5000/research`.

Kenapa jalur ini:

- Tidak perlu memindahkan repo ke laptop Mas Chris.
- Tidak perlu expose Qdrant, Redis, Ollama, atau port internal ke internet.
- Identity Mas Chris bisa dipasang via environment variable.
- Hak akses tetap bisa dibatasi di SSH/OS, VSCode, dan guardrail CLI.

## Setup Operator

Langkah yang dikerjakan founder/operator, bukan ditulis ke repo:

### Status Server Saat Ini

Server JAGAT saat ini adalah Windows bare-metal yang biasa diakses lewat RDP.

Hasil pengecekan terakhir:

- Public IP: `103.190.0.113`
- Tailscale IP: `100.80.82.94`
- Windows user aktif: `win-gtsg0nsv73u\administrator`
- OpenSSH Server: ter-install
- Service `sshd`: `Stopped`
- Startup type `sshd`: `Manual`

Artinya: Mas Chris belum bisa masuk lewat VSCode Remote SSH sampai `sshd` dinyalakan oleh founder/operator dari sesi RDP.

### Aktivasi SSH dari RDP

Jalankan PowerShell sebagai Administrator di server:

```powershell
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
Get-Service sshd
```

Status yang diharapkan:

```text
Name   Status   StartType
sshd   Running  Automatic
```

Jika Windows Firewall belum membuka port SSH, jalankan:

```powershell
New-NetFirewallRule -Name sshd -DisplayName "OpenSSH Server (sshd)" -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

### Akun Mas Chris

Jangan gunakan akun `administrator` untuk pilot Mas Chris kecuali darurat. Buat user Windows khusus, misalnya `christoper`, lalu batasi aksesnya sesuai kebutuhan pilot.

Contoh dari PowerShell Administrator:

```powershell
New-LocalUser -Name "christoper" -Description "JAGAT coding assist pilot user"
Add-LocalGroupMember -Group "Users" -Member "christoper"
```

Setelah user dibuat, berikan akses folder pilot secara terbatas. Untuk tahap awal, founder/operator bisa mendampingi lewat RDP sampai akses SSH tervalidasi.

### Alamat SSH untuk VSCode

Prioritas akses:

1. Tailscale SSH/IP, lebih aman untuk pilot:

```bash
ssh christoper@100.80.82.94
```

2. Public IP, hanya jika firewall dan kredensial sudah siap:

```bash
ssh christoper@103.190.0.113
```

Jika masih memakai akun administrator sementara, formatnya:

```bash
ssh administrator@100.80.82.94
```

Namun ini tidak direkomendasikan untuk pilot eksternal.

### Checklist Operator

1. Aktifkan `sshd` dari RDP.
2. Buat akun OS/SSH khusus untuk Mas Chris jika belum ada.
3. Berikan akses hanya ke workspace pilot yang diperlukan.
4. Pastikan stack lokal aktif:

```powershell
npm run ops:health
```

5. Pastikan CLI tersedia:

```powershell
npm run jagat:code -- --help
```

6. Jika token API internal nanti diberlakukan, kirim token lewat jalur aman. Jangan simpan token di Markdown, CSV, atau git.

## Setup Mas Chris di VSCode

1. Install VSCode.
2. Install extension `Remote - SSH`.
3. Tambahkan host SSH yang diberikan founder/operator.
4. Connect ke host tersebut.
5. Buka folder repo JAGAT.
6. Buka terminal VSCode, lalu set identitas sesi:

```powershell
$env:JAGAT_ACTOR="christoper"
$env:JAGAT_ROLE="executive_product"
$env:JAGAT_BACKEND_URL="http://127.0.0.1:5000"
$env:JAGAT_CODE_ASSIST_TIMEOUT_MS="420000"
```

7. Cek bantuan CLI:

```powershell
npm run jagat:code -- --help
```

## Cara Pakai

Review satu file:

```powershell
npm run jagat:code -- review --file src/colony/model-router.ts
```

Jelaskan file UI:

```powershell
npm run jagat:code -- explain --file jagat-ui/src/app/page.tsx
```

Buat rencana implementasi:

```powershell
npm run jagat:code -- plan "buat UX pricing usage meter untuk pilot internal"
```

Minta saran test untuk bagian tertentu:

```powershell
npm run jagat:code -- test --file src/colony/worker-sandbox.ts --lines 1:220
```

Cari konteks lalu minta arahan:

```powershell
npm run jagat:code -- plan "cek titik integrasi router" --search "routeModelForTask"
```

Preview prompt tanpa menghubungi backend:

```powershell
npm run jagat:code -- review --file src/colony/model-router.ts --dry-run
```

## Batasan Pilot

Boleh:

- Membaca dan membahas file di `src/`, `jagat-ui/src/`, `ops/`, dan `scripts/`.
- Review bug, risiko, type safety, edge case, dan test.
- Membuat rencana patch untuk direview founder/operator.

Tidak boleh:

- Mengubah `.env`, credential, token, secret, SSH key, atau config produksi.
- Deploy, restart service produksi, atau mengubah port/host/connection string.
- Auto-apply patch dari saran AI tanpa review manusia.
- Membuka file auth sensitif atau material kunci.
- Menggunakan akses founder mode.

## SOP Ujicoba 60 Menit

1. 10 menit: buka repo, jalankan `npm run ops:health`.
2. 15 menit: jalankan `review` pada 1 file UI atau service kecil.
3. 15 menit: jalankan `plan` untuk 1 task produk kecil.
4. 10 menit: jalankan `test` untuk file yang sama.
5. 10 menit: tulis feedback: jawaban berguna/tidak, sumber file tepat/tidak, dan apakah saran bisa dieksekusi.

## Format Feedback Mas Chris

```markdown
## Mas Chris Pilot Feedback
- Task:
- Command:
- File:
- Yang membantu:
- Yang kurang:
- Apakah saran bisa dipakai:
- Risiko atau kebingungan:
```

## Troubleshooting

Jika backend mati:

```powershell
npm run ops:health
```

Jika command ditolak karena guardrail, pilih file/task lain atau minta founder/operator review.

Jika jawaban terasa lambat, jalankan ulang setelah Ollama warm atau pakai file/range yang lebih kecil dengan `--lines`.

First run bisa 3-7 menit jika model Ollama cold. Jika timeout, ulangi command yang sama atau naikkan `JAGAT_CODE_ASSIST_TIMEOUT_MS` untuk sesi tersebut.

Jika butuh edit nyata, Mas Chris membuat proposal perubahan dulu. Founder/operator atau Codex yang apply patch setelah review.
