"""add_pgvector_hnsw_and_indexes

Revision ID: g1a2b3c4d5e6
Revises: b1c2d3e4f5a6
Create Date: 2026-10-16 11:15:00.000000

"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: str | Sequence[str] | None = 'b1c2d3e4f5a6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        # 1. Guarantee pgvector extension is installed
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 2. Create HNSW vector similarity index for cosine distance
        try:
            op.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chunk_embedding_hnsw
                ON knowledge_chunks
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
                """
            )
        except Exception:
            pass

    # Tenant composite index on knowledge_chunks
    try:
        op.create_index('idx_chunk_tenant_workspace', 'knowledge_chunks', ['workspace_id'], unique=False)
    except Exception:
        pass


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    try:
        op.drop_index('idx_chunk_tenant_workspace', table_name='knowledge_chunks')
    except Exception:
        pass

    if is_postgres:
        try:
            op.execute("DROP INDEX IF EXISTS idx_chunk_embedding_hnsw;")
        except Exception:
            pass
