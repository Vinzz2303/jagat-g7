# JAGAT G7 - Hybrid Split-Brain Setup Guide

Panduan ini ditujukan bagi Founder untuk menghubungkan laptop lokal (Acer Nitro 5 - RTX 3060) sebagai "otak" (*inference worker*) bagi VPS JAGAT G7, tanpa mengorbankan uptime *website* B2B.

## Konsep Dasar
- **VPS (Server 24/7):** Menjalankan Next.js UI, API Express, dan Database Vector (Qdrant). Melayani klien dan memegang database.
- **Laptop (Nitro 5):** Menjalankan *Ollama* (AI Engine) menggunakan GPU RTX 3060.
- Keduanya berkomunikasi melalui VPN privat (Tailscale).

---

## Langkah 1: Persiapan Jaringan Privat (Tailscale)
1. Buat akun gratis di [Tailscale.com](https://tailscale.com/).
2. Unduh dan instal Tailscale di laptop Nitro 5 Anda.
3. Login ke Tailscale di laptop. Anda akan mendapatkan IP privat khusus laptop Anda (biasanya berawalan `100.x.x.x`).
4. Instal Tailscale di VPS Anda:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
5. Login ke akun yang sama pada VPS. Kini VPS dan laptop Anda berada dalam jaringan LAN yang sama.

## Langkah 2: Persiapan AI di Laptop (RTX 3060)
1. Unduh dan instal **Ollama** versi Windows dari [Ollama.com](https://ollama.com).
2. Tarik model LLM (Llama 3 atau Qwen) melalui terminal laptop:
   ```cmd
   ollama run llama3.2:1b
   ```
   *(Untuk AGI/Prospecting, Anda bisa juga menggunakan model lebih pintar seperti `qwen2.5-coder:7b` asalkan VRAM 6GB Anda mencukupi).*
3. Agar Ollama di laptop bisa menerima request dari luar (Tailscale), jalankan Ollama dengan setingan *environment variable* host:
   - Buka Command Prompt, ketik:
     ```cmd
     set OLLAMA_HOST=0.0.0.0
     ollama serve
     ```

## Langkah 3: Konfigurasi Split-Brain di VPS
1. Buka file `.env` di VPS.
2. Tambahkan / sesuaikan konfigurasi *Remote Ollama* dengan menggunakan IP Tailscale laptop Anda:
   ```env
   OLLAMA_REMOTE_ENABLED=true
   OLLAMA_REMOTE_URL=http://100.x.y.z:11434
   ```
   *(Ganti `100.x.y.z` dengan IP Tailscale laptop Nitro 5 Anda).*
3. Restart backend JAGAT G7 di VPS:
   ```bash
   pm2 restart backend
   ```

## Selesai!
Kini setiap kali ada proses berfikir (*inference*) dari agen JAGAT G7 (seperti otomatisasi prospek atau Colony task), VPS akan secara otomatis menembak *request* ke RTX 3060 laptop Anda dengan kecepatan tinggi. 
Jika laptop Anda mati, VPS akan secara otomatis kembali (fallback) menggunakan CPU servernya sendiri agar sistem tidak *down*.
