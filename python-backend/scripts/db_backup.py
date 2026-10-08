import os
import shutil
import time
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

def backup_sqlite_database():
    source_db = DATA_DIR / "aaas_enterprise.db"
    if not source_db.exists():
        print(f"No local database found at {source_db} to backup.")
        return

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    target_backup = BACKUP_DIR / f"aaas_enterprise_backup_{timestamp}.db"
    shutil.copy2(source_db, target_backup)
    print(f"Database backup created successfully: {target_backup}")

    # Retain last 7 backups
    backups = sorted(BACKUP_DIR.glob("aaas_enterprise_backup_*.db"))
    if len(backups) > 7:
        for old in backups[:-7]:
            old.unlink()
            print(f"Pruned older backup: {old.name}")

if __name__ == "__main__":
    backup_sqlite_database()
