#!/usr/bin/env bash
# ShopMate AaaS - Automated PostgreSQL Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/shopmate-postgres}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_URL="${DATABASE_URL:-postgresql://shopmate_user:password@localhost:5432/shopmate}"
TARGET_FILE="${BACKUP_DIR}/shopmate_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting automated PostgreSQL backup to ${TARGET_FILE}..."
pg_dump "${DATABASE_URL}" --format=custom --no-owner --no-privileges | gzip > "${TARGET_FILE}"

echo "[SUCCESS] Backup completed. Size: $(du -h "${TARGET_FILE}" | cut -f1)"

# Keep 14 days of backups; prune older snapshots
find "${BACKUP_DIR}" -type f -name "shopmate_backup_*.sql.gz" -mtime +14 -delete
echo "[INFO] Cleaned up backups older than 14 days."
