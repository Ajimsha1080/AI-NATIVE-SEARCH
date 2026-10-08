"""add_idempotency_and_sync_jobs

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-10-08 17:12:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a1'
down_revision: str | Sequence[str] | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        op.create_table(
            'idempotency_keys',
            sa.Column('id', sa.String(length=128), primary_key=True, nullable=False),
            sa.Column('response_json', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_idempotency_keys_id', 'idempotency_keys', ['id'], unique=False)
    except Exception:
        pass

    try:
        op.create_table(
            'sync_jobs',
            sa.Column('id', sa.String(length=64), primary_key=True, nullable=False),
            sa.Column('workspace_id', sa.String(length=64), sa.ForeignKey('workspaces.id'), nullable=False),
            sa.Column('connector_type', sa.String(length=64), nullable=False),
            sa.Column('status', sa.String(length=32), nullable=False, server_default='PENDING'),
            sa.Column('synced_items_count', sa.Integer(), server_default='0', nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_sync_jobs_id', 'sync_jobs', ['id'], unique=False)
        op.create_index('idx_sync_job_tenant', 'sync_jobs', ['workspace_id', 'status'], unique=False)
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_table('sync_jobs')
    except Exception:
        pass
    try:
        op.drop_table('idempotency_keys')
    except Exception:
        pass
