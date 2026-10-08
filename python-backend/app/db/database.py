import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

# Base declarative class
Base = declarative_base()

# Resolve Database URL
# In enterprise production: postgresql+asyncpg://user:pass@host:5432/dbname
# In local dev: sqlite+aiosqlite:///./data/aaas_enterprise.db
DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
DEFAULT_DATA_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DB_PATH = DEFAULT_DATA_DIR / "aaas_enterprise.db"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Use SQLite async driver
    DATABASE_URL = f"sqlite+aiosqlite:///{DEFAULT_DB_PATH.as_posix()}"

from sqlalchemy.pool import NullPool

# Engine options
engine_kwargs = {
    "echo": False,
    "future": True,
}

if "sqlite" in DATABASE_URL:
    # SQLite specific connection arguments
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = NullPool
else:
    # PostgreSQL enterprise pooling settings
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_recycle"] = 3600

from sqlalchemy import event
from sqlalchemy.engine import Engine


# SQLite high performance PRAGMAs (WAL mode, large cache, memory temp store, mmap)
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")  # 64MB memory page cache
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA mmap_size=268435456")  # 256MB memory mapped I/O
        cursor.close()
    except Exception:
        pass

engine = create_async_engine(DATABASE_URL, **engine_kwargs)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db_session() -> AsyncSession:
    """Dependency injector for FastAPI endpoints"""
    async with async_session_factory() as session:
        yield session

async def init_db():
    """Initializes database schema and tables asynchronously"""
    from .seed import seed_database_if_empty
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate existing audit_logs columns if needed (SQLite compatibility)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN resource_type VARCHAR(64)"))
        except Exception:
            pass
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN resource_id VARCHAR(128)"))
        except Exception:
            pass
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(64)"))
        except Exception:
            pass
        # Migrate users columns if needed (SQLite compatibility)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
        except Exception:
            pass
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
        except Exception:
            pass
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
        except Exception:
            pass
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
        except Exception:
            pass

    # Run seeding
    async with async_session_factory() as session:
        await seed_database_if_empty(session)
