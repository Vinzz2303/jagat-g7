Write-Host "========================================="
Write-Host " JAGAT G7 - Sovereign Intelligence Core  "
Write-Host " Local AGI Showcase Exporter (Windows)   "
Write-Host "========================================="

$exportDir = ".\ops\local_export"
if (-not (Test-Path $exportDir)) {
    New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
}

Write-Host "[1/3] Packaging JAGAT Core (Excluding node_modules)..."
# Menggunakan tar.exe bawaan Windows 10/11
tar.exe --exclude="node_modules" --exclude=".git" --exclude="ops/local_export" --exclude="ops/migration" -czvf "$exportDir\jagat_core_local.tar.gz" .

Write-Host "[2/3] Verifying Memory Banks..."
if (Test-Path ".\qdrant_data") {
    Write-Host "  -> Qdrant Vector Data found and included."
}
if (Test-Path ".\data") {
    Write-Host "  -> Ledger/Usage Data found and included."
}

Write-Host "[3/3] Generating Local Setup README..."
$readmePath = "$exportDir\README_LOCAL_AGI.txt"
$readmeContent = @"
=========================================
 JAGAT G7 - LOCAL AGI SHOWCASE SETUP
=========================================
Langkah-langkah menyalakan AGI di laptop lokal:

1. Ekstrak 'jagat_core_local.tar.gz' ke folder D:\JAGAT_LOCAL.
2. Pastikan Docker Desktop sedang menyala di Windows Anda.
3. Buka Terminal (CMD/PowerShell) di dalam folder D:\JAGAT_LOCAL:
   a. Ketik: docker-compose up -d     (Menyalakan Database Redis & Qdrant)
   b. Ketik: npm install              (Mengunduh modul)
   c. Ketik: npm run build            (Mempersiapkan UI)
   d. Ketik: npm run ops:start        (Menyalakan Orkestrator Colony)
4. Buka http://localhost:50012 di browser laptop Anda.
5. Selesai! AGI Control Center Anda sudah berjalan 100% offline.
"@

Set-Content -Path $readmePath -Value $readmeContent

Write-Host ""
Write-Host "========================================="
Write-Host " SUCCESS! "
Write-Host " Ekspor AGI Lokal Anda siap di folder:"
Write-Host " .\ops\local_export\"
Write-Host "========================================="
Write-Host "Silakan download isi folder tersebut ke laptop lokal Anda."
