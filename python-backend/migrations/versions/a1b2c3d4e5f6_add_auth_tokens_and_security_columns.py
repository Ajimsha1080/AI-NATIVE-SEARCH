"""add_auth_tokens_and_security_columns

Revision ID: a1b2c3d4e5f6
Revises: ced8fcdd6f45
Create Date: 2026-10-08 17:08:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str | Sequence[str] | None = 'ced8fcdd6f45'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add security and verification columns to users
    try:
        op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('users', sa.Column('is_verified', sa.Boolean(), server_default='0', nullable=True))
    except Exception:
        pass
    try:
        op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=True))
    except Exception:
        pass
    try:
        op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))
    except Exception:
        pass

    # 2. Create auth_tokens table
    try:
        op.create_table(
            'auth_tokens',
            sa.Column('id', sa.String(length=64), primary_key=True, nullable=False),
            sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('token_hash', sa.String(length=128), unique=True, nullable=False),
            sa.Column('token_type', sa.String(length=32), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('used_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_auth_tokens_id', 'auth_tokens', ['id'], unique=False)
        op.create_index('idx_auth_token_lookup', 'auth_tokens', ['token_hash', 'token_type'], unique=False)
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_table('auth_tokens')
    except Exception:
        pass
    try:
        op.drop_column('users', 'locked_until')
        op.drop_column('users', 'failed_login_attempts')
        op.drop_column('users', 'is_verified')
        op.drop_column('users', 'password_hash')
    except Exception:
        pass
