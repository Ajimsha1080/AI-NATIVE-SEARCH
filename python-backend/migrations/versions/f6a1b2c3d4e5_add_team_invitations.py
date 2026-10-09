"""add_team_invitations

Revision ID: f6a1b2c3d4e5
Revises: e5f6a1b2c3d4
Create Date: 2026-10-09 03:05:00.000000

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f6a1b2c3d4e5'
down_revision: str | Sequence[str] | None = 'e5f6a1b2c3d4'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create workspace_invitations table
    op.create_table(
        'workspace_invitations',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('workspace_id', sa.String(length=64), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=32), server_default='VIEWER', nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False),
        sa.Column('invited_by_user_id', sa.String(length=64), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_invite_workspace', 'workspace_invitations', ['workspace_id'])
    op.create_index('idx_invite_email', 'workspace_invitations', ['email'])
    op.create_index('idx_invite_token_hash', 'workspace_invitations', ['token_hash'], unique=True)
    op.create_index('idx_invite_ws_status', 'workspace_invitations', ['workspace_id', 'status'])

    # Enable RLS on PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        try:
            op.execute("ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE workspace_invitations FORCE ROW LEVEL SECURITY;")
            op.execute(
                """
                CREATE POLICY workspace_invitations_tenant_isolation_policy ON workspace_invitations
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
            op.execute("DROP POLICY IF EXISTS workspace_invitations_tenant_isolation_policy ON workspace_invitations;")
        except Exception:
            pass
    op.drop_table('workspace_invitations')
