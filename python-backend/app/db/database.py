import os
from pathlib import Path

from fastapi import Request
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
_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Returns the active sessionmaker factory, supporting dynamic test engine overrides."""
    global _session_factory
    return _session_factory


def set_session_factory(factory: async_sessionmaker[AsyncSession]) -> None:
    """Sets the active sessionmaker factory (e.g. for isolated test suites)."""
    global _session_factory, engine
    _session_factory = factory
    engine = factory.kw.get("bind") or getattr(factory, "bind", engine)


class _LazySessionFactory:
    """Proxy object so legacy calls to async_session_factory() resolve dynamically."""
    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


async_session_factory = _LazySessionFactory()

from sqlalchemy import text


async def set_tenant_session_context(session: AsyncSession, workspace_id: str):
    """Sets PostgreSQL session variables app.workspace_id and app.current_workspace_id for Row-Level Security.

    Uses bound parameters (no string interpolation) to guarantee safe parameter binding.
    Raises RuntimeError if setting fails on PostgreSQL.
    """
    if not workspace_id:
        return
    bind = session.bind
    dialect_name = getattr(bind.dialect, "name", "") if bind else ""
    if dialect_name == "postgresql":
        try:
            # PostgreSQL set_config(setting_name, new_value, is_local)
            await session.execute(
                text("SELECT set_config('app.workspace_id', :ws, true)"),
                {"ws": str(workspace_id)}
            )
            await session.execute(
                text("SELECT set_config('app.current_workspace_id', :ws, true)"),
                {"ws": str(workspace_id)}
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to set PostgreSQL RLS session context for workspace '{workspace_id}': {exc}") from exc


async def get_system_db_session() -> AsyncSession:
    """Explicit system session for unauthenticated operations (signup, login, refresh, webhook)
    before workspace is known, keeping system database access minimal and isolated.
    """
    async with get_session_factory()() as session:
        yield session


async def get_db_session() -> AsyncSession:
    """Dependency injector for general FastAPI health/readiness endpoints."""
    async with get_session_factory()() as session:
        yield session


async def get_tenant_db_session(
    request: Request,
    workspace_id: str | None = None
) -> AsyncSession:
    """FastAPI dependency that opens an async DB session and sets PostgreSQL RLS workspace context."""
    # Resolve workspace_id from request state, auth context, or header if available
    ws_id = workspace_id
    if not ws_id:
        # Check if auth context was resolved on request.state
        auth = getattr(request.state, "auth", None)
        if auth and hasattr(auth, "workspace_id"):
            ws_id = auth.workspace_id
        elif hasattr(request.state, "workspace_id"):
            ws_id = request.state.workspace_id

    async with get_session_factory()() as session:
        if ws_id:
            await set_tenant_session_context(session, ws_id)
        yield session


async def init_db():
    """Initializes database schema and tables asynchronously.
    Only runs Base.metadata.create_all inside automated tests or local SQLite fallback.
    In production environments, schema migrations are driven strictly by Alembic (alembic upgrade head).
    """
    import sys
    is_test = (
        "pytest" in sys.modules
        or os.getenv("TESTING", "").lower() == "true"
        or os.getenv("APP_ENV", "").lower() == "test"
        or "sqlite" in DATABASE_URL
    )
    if is_test:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
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

