"""Add MFA columns, user sessions and api keys with RLS

Revision ID: a1b2c3d4e5f6
Revises: f6a1b2c3d4e5
Create Date: 2026-10-09 13:52:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'f6a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Add MFA columns to users table
    try:
        op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), server_default=sa.text('false'), nullable=False))
        op.add_column('users', sa.Column('mfa_secret', sa.String(length=128), nullable=True))
        op.add_column('users', sa.Column('mfa_recovery_codes', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
    except Exception:
        pass

    # 2. Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('workspace_id', sa.String(length=64), nullable=False),
        sa.Column('created_by_user_id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('key_prefix', sa.String(length=16), nullable=False),
        sa.Column('key_hash', sa.String(length=128), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_api_keys_workspace', 'api_keys', ['workspace_id'], unique=False)
    op.create_index('idx_api_keys_hash', 'api_keys', ['key_hash'], unique=True)

    # 3. Create user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('workspace_id', sa.String(length=64), nullable=True),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('last_activity_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_user_sessions_user', 'user_sessions', ['user_id'], unique=False)
    op.create_index('idx_user_sessions_active', 'user_sessions', ['user_id', 'is_revoked'], unique=False)

    # 4. PostgreSQL RLS policies
    if is_postgres:
        op.execute("ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;")
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'api_keys' AND policyname = 'tenant_isolation_api_keys'
                ) THEN
                    CREATE POLICY tenant_isolation_api_keys ON api_keys
                    FOR ALL
                    USING (workspace_id = current_setting('app.workspace_id', true))
                    WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
                END IF;
            END
            $$;
        """)


def downgrade():
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;")

    op.drop_table('user_sessions')
    op.drop_table('api_keys')
    try:
        op.drop_column('users', 'mfa_recovery_codes')
        op.drop_column('users', 'mfa_secret')
        op.drop_column('users', 'mfa_enabled')
    except Exception:
        pass
