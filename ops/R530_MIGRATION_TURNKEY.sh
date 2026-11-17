#!/bin/bash
# JAGAT G7 - R530 Turnkey Migration Script
# T-045: Dell PowerEdge R530 Auto-Deploy
# This script prepares the staging node for migration to the new Dell R530.

set -e

echo "========================================="
echo " JAGAT G7 - Sovereign Intelligence Core  "
echo " Dell R530 Bare-Metal Migration Packager "
echo "========================================="

mkdir -p ./ops/migration

# 1. Stop current staging services (Ryzen 5) safely
echo "[1/4] Stopping current processes (graceful)..."
pm2 stop all || echo "PM2 not running or no apps to stop."

# 2. Package data for transfer
echo "[2/4] Dumping Redis Memory..."
redis-cli save || echo "Redis not running locally, skipping dump."
cp /var/lib/redis/dump.rdb ./ops/migration/ 2>/dev/null || echo "Redis dump.rdb not found, skipping."

echo "[3/4] Zipping Qdrant Vector Memory..."
if [ -d "./qdrant_data" ]; then
    tar -czvf ./ops/migration/qdrant_data_backup.tar.gz ./qdrant_data/
else
    echo "No qdrant_data directory found, skipping."
fi

echo "[4/4] Packaging Source Code..."
git archive --format=tar.gz -o ./ops/migration/jagat_source.tar.gz HEAD || echo "Not a git repository, skipping source archive."

echo ""
echo "========================================="
echo " Migration packages ready in ./ops/migration/"
echo ""
echo "Next steps on the Dell R530:"
echo "1. scp -r ./ops/migration/ user@<R530-IP>:~/jagat-migration/"
echo "2. SSH into R530"
echo "3. tar -xzvf ~/jagat-migration/jagat_source.tar.gz"
echo "4. tar -xzvf ~/jagat-migration/qdrant_data_backup.tar.gz"
echo "5. npm install && npm run build"
echo "6. pm2 start pm2-swarm-launcher.mjs"
echo "========================================="
echo "Technical Backlog T-045 is now UNBLOCKED."
