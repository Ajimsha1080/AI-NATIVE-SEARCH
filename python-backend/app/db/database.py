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

from sqlalchemy import text


async def set_tenant_session_context(session: AsyncSession, workspace_id: str):
    """Sets PostgreSQL session variables app.workspace_id and app.current_workspace_id for Row-Level Security."""
    if not workspace_id:
        return
    try:
        bind = session.bind
        if bind and getattr(bind.dialect, "name", "") == "postgresql":
            clean_id = workspace_id.replace("'", "''")
            await session.execute(text(f"SET LOCAL app.workspace_id = '{clean_id}'"))
            await session.execute(text(f"SET LOCAL app.current_workspace_id = '{clean_id}'"))
    except Exception:
        pass


async def get_db_session() -> AsyncSession:
    """Dependency injector for FastAPI endpoints"""
    async with async_session_factory() as session:
        yield session

async def init_db():
    """Initializes database schema and tables asynchronously"""
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
        # Migrate deployments columns if needed (SQLite compatibility)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE deployments ADD COLUMN public_key VARCHAR(128)"))
        except Exception:
            pass
        # Migrate idempotency_keys columns if needed (SQLite compatibility)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE idempotency_keys ADD COLUMN workspace_id VARCHAR(64)"))
        except Exception:
            pass

