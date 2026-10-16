import os
import subprocess
import tempfile
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.auth import create_access_token
from app.db.database import get_session_factory
from app.db.models import KnowledgeChunkModel
from app.main import app
from app.rag import generate_embedding
from app.redis_service import (
    check_rate_limit,
    is_token_revoked,
    revoke_token,
    tenant_cache_get,
    tenant_cache_invalidate,
    tenant_cache_set,
)


@pytest.mark.asyncio
async def test_clean_and_existing_alembic_migrations():
    """Verifies Alembic migrations run cleanly against a 100% fresh clean database."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    try:
        env = os.environ.copy()
        env["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp_db_path.replace(os.sep, '/')}"
        res = subprocess.run(
            ["python", "-m", "alembic", "upgrade", "head"],
            cwd=os.path.join(os.path.dirname(__file__), ".."),
            env=env,
            capture_output=True,
            text=True
        )
        assert res.returncode == 0, f"Alembic upgrade failed on fresh DB: {res.stderr}"
        assert "Running upgrade" in res.stderr
        assert "add_pgvector_hnsw_and_indexes" in res.stderr
    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except Exception:
                pass


def test_pgvector_comparator_compiles_cosine_operator():
    """Verifies that KnowledgeChunkModel.embedding compiles pgvector '<=>' cosine operator on PostgreSQL."""
    query_vec = [0.1] * 1536
    stmt = select(KnowledgeChunkModel).order_by(KnowledgeChunkModel.embedding.cosine_distance(query_vec))
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "<=>" in compiled, f"Expected pgvector '<=>' cosine distance in compiled SQL: {compiled}"


def test_embedding_generation_dimension_and_normalization():
    """Verifies real embedding generation returns 1536-dimensional normalized vector."""
    vec = generate_embedding("BlueTyga Men's Performance Techwear Joggers")
    assert len(vec) == 1536
    assert not all(x == 0.0 for x in vec), "Embedding must not be a dummy zero-filled vector"
    norm = sum(x * x for x in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-3, f"Vector should be unit-normalized: norm={norm}"


@pytest.mark.asyncio
async def test_knowledge_ingestion_and_vector_persistence():
    """Verifies document ingestion generates genuine embeddings and persists chunks."""
    ws_id = f"ws_audit_{uuid.uuid4().hex[:8]}"
    transport = ASGITransport(app=app)
    token = create_access_token(user_id="user_admin", email="admin@example.com", workspace_id=ws_id, role="OWNER")

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Ingest document
        ingest_payload = {
            "title": "Return Policy 2026",
            "content": (
                "Customers can return unworn items within 30 days of delivery for a full refund.\n\n"
                "International returns require a customs declaration form and return label from support."
            ),
            "metadata": {"category": "policy", "version": "2026.1"}
        }
        res = await client.post(
            "/api/v1/knowledge/ingest",
            json=ingest_payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        doc_id = data["document_id"]
        assert data["chunks_created"] == 2

        # Verify chunks in DB have real 1536-dim embeddings and workspace_id
        async with get_session_factory()() as session:
            stmt = select(KnowledgeChunkModel).where(KnowledgeChunkModel.doc_id == doc_id)
            chunks = (await session.execute(stmt)).scalars().all()
            assert len(chunks) == 2
            for c in chunks:
                assert c.workspace_id == ws_id
                assert len(c.embedding) == 1536
                assert not all(x == 0.0 for x in c.embedding)
                assert c.metadata_json.get("category") == "policy"


@pytest.mark.asyncio
async def test_knowledge_document_crud_and_cascade_delete():
    """Verifies document listing, retrieval, update, and cascading deletion."""
    ws_id = f"ws_audit_{uuid.uuid4().hex[:8]}"
    transport = ASGITransport(app=app)
    token = create_access_token(user_id="user_admin", email="admin@example.com", workspace_id=ws_id, role="OWNER")

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Ingest
        res = await client.post(
            "/api/v1/knowledge/ingest",
            json={"title": "Shipping Guide", "content": "Orders ship via Delhivery within 24 hours."},
            headers={"Authorization": f"Bearer {token}"}
        )
        doc_id = res.json()["document_id"]

        # 2. List documents
        res = await client.get("/api/v1/knowledge/documents", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        docs = res.json()["documents"]
        assert any(d["id"] == doc_id for d in docs)

        # 3. Get single document
        res = await client.get(f"/api/v1/knowledge/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["title"] == "Shipping Guide"
        assert len(res.json()["chunks"]) == 1

        # 4. Update document
        res = await client.put(
            f"/api/v1/knowledge/documents/{doc_id}",
            json={"title": "Express Shipping Guide", "content": "Orders now ship via Bluedart Express."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        assert res.json()["title"] == "Express Shipping Guide"

        # 5. Delete document
        res = await client.delete(f"/api/v1/knowledge/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Verify cascading deletion of chunks
        async with get_session_factory()() as session:
            stmt = select(KnowledgeChunkModel).where(KnowledgeChunkModel.doc_id == doc_id)
            chunks = (await session.execute(stmt)).scalars().all()
            assert len(chunks) == 0


@pytest.mark.asyncio
async def test_vector_search_with_metadata_filtering_and_tenant_isolation():
    """Verifies database vector similarity search respects metadata filtering and strict tenant boundaries."""
    ws_a = f"ws_audit_a_{uuid.uuid4().hex[:6]}"
    ws_b = f"ws_audit_b_{uuid.uuid4().hex[:6]}"
    transport = ASGITransport(app=app)
    token_a = create_access_token(user_id="user_a", email="user_a@example.com", workspace_id=ws_a, role="OWNER")
    token_b = create_access_token(user_id="user_b", email="user_b@example.com", workspace_id=ws_b, role="OWNER")

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Tenant A ingests confidential doc
        await client.post(
            "/api/v1/knowledge/ingest",
            json={
                "title": "Tenant A Secret Blueprint",
                "content": "Secret patent proprietary titanium alloy blend specs.",
                "metadata": {"confidential": "true", "dept": "R&D"}
            },
            headers={"Authorization": f"Bearer {token_a}"}
        )

        # Tenant B ingests public doc
        await client.post(
            "/api/v1/knowledge/ingest",
            json={
                "title": "Tenant B Public FAQ",
                "content": "Public hours of operation are Monday to Friday 9am to 6pm.",
                "metadata": {"confidential": "false", "dept": "Support"}
            },
            headers={"Authorization": f"Bearer {token_b}"}
        )

        # Search from Tenant A with metadata filter
        res_a = await client.post(
            "/api/v1/knowledge/search",
            json={"query": "titanium alloy specs", "top_k": 5, "metadata_filter": {"dept": "R&D"}},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_a.status_code == 200
        results_a = res_a.json()["results"]
        assert len(results_a) > 0
        assert "titanium alloy" in results_a[0]["text"]
        assert results_a[0]["metadata"]["dept"] == "R&D"

        # Search from Tenant B for Tenant A's content - must return 0 hits (Zero cross-tenant leakage!)
        res_b = await client.post(
            "/api/v1/knowledge/search",
            json={"query": "titanium alloy specs", "top_k": 5},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res_b.status_code == 200
        results_b = res_b.json()["results"]
        for r in results_b:
            assert "titanium alloy" not in r["text"]


@pytest.mark.asyncio
async def test_complete_rag_pipeline_end_to_end():
    """Tests the full RAG pipeline: Ingestion -> Vector Retrieval -> RRF -> Context -> Synthesis & Verified Citations."""
    ws_id = f"ws_rag_{uuid.uuid4().hex[:8]}"
    transport = ASGITransport(app=app)
    token = create_access_token(user_id="user_rag", email="rag@example.com", workspace_id=ws_id, role="OWNER")

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Ingest warranty document
        await client.post(
            "/api/v1/knowledge/ingest",
            json={
                "title": "Extended Warranty Terms",
                "content": (
                    "All techwear jackets include a comprehensive 2-year warranty against zipper and seam defects.\n\n"
                    "Warranty claims are processed within 48 hours upon providing the order number."
                )
            },
            headers={"Authorization": f"Bearer {token}"}
        )

        # 2. Query RAG pipeline
        rag_res = await client.post(
            "/api/v1/rag/query",
            json={"question": "What is the warranty period for techwear jackets?"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert rag_res.status_code == 200, rag_res.text
        data = rag_res.json()
        assert data["workspace_id"] == ws_id
        assert data["hybrid_retrieval"]["dense_hits"] > 0
        assert data["rrf_fusion"]["fused_candidates"] > 0
        assert "2-year warranty" in data["natural_answer"]
        assert data["grounding_verification"]["is_grounded"] is True
        assert len(data["citations"]) > 0
        assert data["citations"][0]["document_name"] == "Extended Warranty Terms"


@pytest.mark.asyncio
async def test_redis_features_and_tenant_caching():
    """Verifies Redis rate limiting, token revocation, tenant cache isolation, and invalidation."""
    ws_id = f"ws_redis_{uuid.uuid4().hex[:8]}"
    other_ws = f"ws_redis_other_{uuid.uuid4().hex[:8]}"

    # 1. Rate limiting
    allowed, retry_after = await check_rate_limit(f"user_test_{uuid.uuid4().hex}", max_requests=3, window_seconds=60)
    assert allowed is True
    assert retry_after == 0

    # 2. Token revocation & denylist
    fake_token = f"jwt_{uuid.uuid4().hex}"
    assert await is_token_revoked(fake_token) is False
    await revoke_token(fake_token, ttl_seconds=300)
    assert await is_token_revoked(fake_token) is True

    # 3. Tenant cache isolation
    await tenant_cache_set(ws_id, "user_profile", {"theme": "dark", "lang": "en"}, ttl_seconds=60)
    cached_a = await tenant_cache_get(ws_id, "user_profile")
    assert cached_a == {"theme": "dark", "lang": "en"}

    # Tenant B cannot access Tenant A's cache key
    cached_b = await tenant_cache_get(other_ws, "user_profile")
    assert cached_b is None

    # 4. Cache invalidation
    await tenant_cache_set(ws_id, "metrics", {"count": 42}, ttl_seconds=60)
    invalidated = await tenant_cache_invalidate(ws_id)
    assert invalidated >= 1
    assert await tenant_cache_get(ws_id, "user_profile") is None
    assert await tenant_cache_get(ws_id, "metrics") is None
