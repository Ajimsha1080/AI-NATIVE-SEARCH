"""add_usage_records_and_meters

Revision ID: e5f6a1b2c3d4
Revises: d4e5f6a1b2c3
Create Date: 2026-10-09 02:55:00.000000

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f6a1b2c3d4'
down_revision: str | Sequence[str] | None = 'd4e5f6a1b2c3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create billing_usage_records table
    op.create_table(
        'billing_usage_records',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('workspace_id', sa.String(length=64), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('period_month', sa.String(length=7), nullable=False),  # Format: 'YYYY-MM'
        sa.Column('search_requests', sa.Integer(), server_default='0', nullable=False),
        sa.Column('chat_requests', sa.Integer(), server_default='0', nullable=False),
        sa.Column('tokens_in', sa.Integer(), server_default='0', nullable=False),
        sa.Column('tokens_out', sa.Integer(), server_default='0', nullable=False),
        sa.Column('estimated_cost_usd', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('crawl_runs', sa.Integer(), server_default='0', nullable=False),
        sa.Column('alert_80_sent', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('alert_100_sent', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_usage_workspace', 'billing_usage_records', ['workspace_id'])
    op.create_index('idx_usage_ws_month', 'billing_usage_records', ['workspace_id', 'period_month'], unique=True)

    # Enable RLS on PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        try:
            op.execute("ALTER TABLE billing_usage_records ENABLE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE billing_usage_records FORCE ROW LEVEL SECURITY;")
            op.execute(
                """
                CREATE POLICY billing_usage_records_tenant_isolation_policy ON billing_usage_records
                USING (workspace_id = COALESCE(
                    NULLIF(current_setting('app.workspace_id', true), ''),
                    NULLIF(current_setting('app.current_workspace_id', true), '')
                ))
                WITH CHECK (workspace_id = COALESCE(
                    NULLIF(current_setting('app.workspace_id', true), ''),
                    NULLIF(current_setting('app.current_workspace_id', true), '')
                ));
                """
            )
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        try:
            op.execute("DROP POLICY IF EXISTS billing_usage_records_tenant_isolation_policy ON billing_usage_records;")
        except Exception:
            pass
    op.drop_table('billing_usage_records')
