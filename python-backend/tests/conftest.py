"""Pytest configuration and isolated database fixtures.

Ensures that test suites run with isolated database state without polluting
production data directories.
"""

import os
import tempfile

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.database import Base


@pytest.fixture(scope="function")
async def isolated_test_db():
    """Provisions a temporary, completely isolated SQLite database for a test."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    test_url = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(test_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        yield session

    await engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass
