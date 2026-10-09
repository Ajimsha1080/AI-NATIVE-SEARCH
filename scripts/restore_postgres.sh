#!/usr/bin/env bash
# ShopMate AaaS - PostgreSQL Restore Script
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL:-postgresql://shopmate_user:password@localhost:5432/shopmate}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "[WARNING] Restoring database from ${BACKUP_FILE}. This will replace existing records!"
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "Restore aborted by user."
  exit 0
fi

echo "[INFO] Restoring PostgreSQL database..."
gunzip -c "${BACKUP_FILE}" | pg_restore --clean --if-exists --no-owner --no-privileges -d "${DATABASE_URL}"

echo "[SUCCESS] Restore finished. Running alembic migrations to verify schema head..."
cd python-backend && alembic upgrade head
echo "[SUCCESS] Database restored and aligned with latest schema."
