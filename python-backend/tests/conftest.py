"""Pytest configuration and isolated database fixtures.

Ensures that test suites run with isolated database state without polluting
production data directories.
"""

import os
import tempfile

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.database import Base, get_session_factory, set_session_factory


@pytest.fixture(scope="function", autouse=True)
async def isolated_test_db():
    """Provisions a temporary, completely isolated SQLite database for every test,

    patching the global database session factory so the app and tests share the exact same DB.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    test_url = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(test_url, echo=False, poolclass=NullPool, connect_args={"check_same_thread": False})
    test_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    original_factory = get_session_factory()
    set_session_factory(test_session_factory)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        async with test_session_factory() as session:
            yield session
    finally:
        set_session_factory(original_factory)
        await engine.dispose()
        try:
            if os.path.exists(db_path):
                os.remove(db_path)
        except Exception:
            pass

