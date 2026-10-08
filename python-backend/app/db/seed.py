"""Database Seed Utility (Production Mode)

Demo and fake data have been removed. Use `app.db.bootstrap_admin` to create
initial production administrative accounts via environment variables:
    export ADMIN_EMAIL="admin@yourcompany.com"
    export ADMIN_PASSWORD="your-strong-password"
    python -m app.db.bootstrap_admin
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("shopmate_seed")


async def seed_database_if_empty(session: AsyncSession) -> None:
    """Production database initializer: no hardcoded or mock data is seeded."""
    logger.info("Database initialized without mock data. Use bootstrap_admin for initial account provisioning.")
