#!/bin/bash
# JAGAT G7 - Local AGI Showcase Exporter
# Packages the entire JAGAT G7 project for execution on a local Windows machine.

echo "========================================="
echo " JAGAT G7 - Sovereign Intelligence Core  "
echo " Local AGI Showcase Exporter             "
echo "========================================="

mkdir -p ./ops/local_export

# 1. Archive the entire JAGAT workspace excluding heavy node_modules and .git
echo "[1/3] Packaging JAGAT Core (Excluding node_modules)..."
tar --exclude='node_modules' --exclude='.git' --exclude='ops/local_export' --exclude='ops/migration' -czvf ./ops/local_export/jagat_core_local.tar.gz .

# 2. Memory preservation
echo "[2/3] Verifying Memory Banks..."
if [ -d "./qdrant_data" ]; then
    echo "  -> Qdrant Vector Data found and included."
fi
if [ -d "./data" ]; then
    echo "  -> Ledger/Usage Data found and included."
fi

# 3. Create a README for local setup
echo "[3/3] Generating Local Setup README..."
cat << 'EOF' > ./ops/local_export/README_LOCAL_AGI.txt
=========================================
 JAGAT G7 - LOCAL AGI SHOWCASE SETUP
=========================================
Langkah-langkah menyalakan AGI di laptop:

1. Ekstrak 'jagat_core_local.tar.gz' ke folder D:\JAGAT_LOCAL.
2. Pastikan Docker Desktop sedang menyala di Windows Anda.
3. Buka Terminal (CMD/PowerShell) di dalam D:\JAGAT_LOCAL:
   a. Ketik: docker-compose up -d     (Menyalakan Database Redis & Qdrant)
   b. Ketik: npm install              (Mengunduh modul)
   c. Ketik: npm run build            (Mempersiapkan UI)
   d. Ketik: npm run ops:start        (Menyalakan Orkestrator Colony)
4. Buka http://localhost:50012 di browser laptop Anda.
5. Selesai! AGI Control Center Anda sudah berjalan 100% offline.
EOF

echo ""
echo "========================================="
echo " SUCCESS! "
echo " Ekspor AGI Lokal Anda siap di folder:"
echo " ./ops/local_export/"
echo "========================================="
echo "Silakan download folder tersebut ke laptop lokal Anda."
