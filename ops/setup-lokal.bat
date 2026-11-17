@echo off
TITLE Setup Agen Lokal - JAGAT G7
echo ====================================================
echo     JAGAT G7 - Local AI Agent Setup (Nitro 5)
echo ====================================================
echo.

echo [1/3] Mempersiapkan Drive D: untuk menyimpan model Ollama...
if not exist "D:\OllamaModels" (
    mkdir "D:\OllamaModels"
    echo [+] Folder D:\OllamaModels berhasil dibuat.
) else (
    echo [+] Folder D:\OllamaModels sudah ada.
)

echo.
echo [+] Mendaftarkan OLLAMA_MODELS ke System Environment Variables...
echo [+] (Membutuhkan akses Administrator)
setx OLLAMA_MODELS "D:\OllamaModels" /M
if %errorlevel% neq 0 (
    echo.
    echo [!] PERINGATAN: Akses ditolak.
    echo [!] Tolong jalankan skrip ini sebagai Administrator!
    echo [!] (Klik kanan file bat ini -^> Run as Administrator)
    pause
    exit /b
)
echo [+] Environment variable OLLAMA_MODELS=D:\OllamaModels berhasil didaftarkan secara global!

echo.
echo [2/3] Menginstal OpenClaw (Agen Otonom Pencari Prospek)...
echo [+] Mengecek instalasi Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [!] Node.js tidak ditemukan!
    echo [!] Silakan download dan instal Node.js terlebih dahulu dari https://nodejs.org/
    pause
    exit /b
)

echo [+] Node.js terdeteksi. Mulai mengunduh dan menginstal @openclaw/cli via NPM...
call npm install -g @openclaw/cli
echo [+] OpenClaw berhasil diinstal.

echo.
echo [3/3] Setup Selesai!
echo ====================================================
echo PENTING: Anda harus me-RESTART komputer Anda sekarang 
echo agar sistem mengenali OLLAMA_MODELS di Drive D.
echo ====================================================
echo Setelah Restart:
echo 1. Instal Ollama dari https://ollama.com. Model akan otomatis aman di Drive D.
echo 2. Buka terminal, ketik 'ollama run qwen2.5-coder:7b' untuk Agen Coding.
echo 3. Hubungkan Cline/Continue di VSCode ke Ollama (http://127.0.0.1:11434).
echo 4. Ketik 'openclaw start' untuk mulai mengaktifkan asisten pencari Anda.
echo ====================================================
pause
