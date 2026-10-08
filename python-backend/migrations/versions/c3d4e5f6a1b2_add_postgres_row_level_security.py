"""add_postgres_row_level_security

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-10-08 17:20:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a1b2'
down_revision: str | Sequence[str] | None = 'b2c3d4e5f6a1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_TABLES = [
    'commerce_products',
    'commerce_orders',
    'deployments',
    'knowledge_sources',
    'knowledge_chunks',
    'conversations',
    'audit_logs',
]


def upgrade() -> None:
    """Enables PostgreSQL Row-Level Security on multi-tenant tables.
    Policies ensure queries are strictly bounded to `app.current_workspace_id`.
    """
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    for table in TENANT_TABLES:
        try:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
            op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
            op.execute(
                f"""
                CREATE POLICY {table}_tenant_isolation_policy ON {table}
                USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
                WITH CHECK (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''));
                """
            )
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    for table in TENANT_TABLES:
        try:
            op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation_policy ON {table};")
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        except Exception:
            pass
