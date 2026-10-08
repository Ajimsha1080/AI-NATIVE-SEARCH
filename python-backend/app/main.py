import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from .agent_runtime import run_agent_cycle
from .auth import require_admin_auth, verify_service_jwt
from .db.database import get_db_session, init_db
from .db.repository import DatabaseRepository
from .llm import LLMClient
from .models import ChatRequest, ChatResponse, KnowledgeIngestRequest, RAGQueryRequest
from .rag import execute_rag_pipeline

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://bluetyga.com",
    "*"
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Enterprise Database Schema & Seeding
    await init_db()
    from .redis_service import get_redis_client
    await get_redis_client()
    from .worker import task_worker
    await task_worker.start()
    yield
    await task_worker.stop()

app = FastAPI(
    title="ShopMate AaaS Enterprise Python AI Engine",
    version="2.0.0",
    description="Enterprise Python FastAPI backend powering Database-backed 12-stage RAG, Multi-step Agent Runtime, and E-commerce Tools.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from .middleware.logging_middleware import StructuredLoggingMiddleware
from .middleware.rate_limiter import EnterpriseRateLimiterMiddleware

app.add_middleware(EnterpriseRateLimiterMiddleware)
app.add_middleware(StructuredLoggingMiddleware)

from .ai_mode import router as ai_mode_router
from .auth import router as auth_router
from .catalog import router as catalog_router
from .compliance import router as compliance_router

app.include_router(auth_router)
app.include_router(ai_mode_router)
app.include_router(catalog_router)
app.include_router(compliance_router)

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "shopmate-python-backend",
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.get("/ready")
async def readiness_check(session: AsyncSession = Depends(get_db_session)):
    # 1. Verify Relational Database probe
    try:
        from sqlalchemy import text
        await session.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database probe failed: {e!s}")

    # 2. Check LLM Runtime
    client = LLMClient()
    app_env = os.getenv("APP_ENV", "development").lower()
    if app_env != "development" and not client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="LLM runtime is not configured for production environment."
        )

    return {
        "status": "READY",
        "database": "CONNECTED",
        "vector_engine": "ACTIVE",
        "llm_runtime": "INITIALIZED" if client.is_configured() else "DEV_FALLBACK",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.get("/api/v1/db/status")
async def get_db_status(
    admin_claims: dict[str, Any] = Depends(require_admin_auth),
    session: AsyncSession = Depends(get_db_session)
):
    """Returns the live status of the Enterprise Database (Protected: Admin/Service Token Required)."""
    repo = DatabaseRepository(session)
    products = await repo.get_all_products(workspace_id=admin_claims["workspace_id"])
    chunks = await repo.get_tenant_chunks(workspace_id=admin_claims["workspace_id"])
    return {
        "status": "CONNECTED",
        "workspace_id": admin_claims["workspace_id"],
        "tenant_products": len(products),
        "tenant_knowledge_chunks": len(chunks),
        "persistence": "Enterprise Relational & Vector Storage Active"
    }

@app.post("/api/v1/agents/{agent_id}/chat", response_model=ChatResponse)
async def chat_agent(
    agent_id: str,
    req: ChatRequest,
    claims: dict[str, Any] = Depends(verify_service_jwt)
):
    """
    Executes a full multi-step agent reasoning cycle with 12-stage RAG and tools.
    Workspace ID is strictly derived from the verified service JWT.
    """
    token_workspace_id = claims["workspace_id"]
    if req.workspace_id and req.workspace_id != token_workspace_id and claims.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Cross-tenant workspace mismatch")

    try:
        result = run_agent_cycle(
            agent_id=agent_id,
            message=req.message,
            conversation_id=req.conversation_id,
            workspace_id=token_workspace_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/agents/{agent_id}/chat/stream")
async def chat_agent_stream(
    agent_id: str,
    req: ChatRequest,
    claims: dict[str, Any] = Depends(verify_service_jwt)
):
    token_workspace_id = claims["workspace_id"]
    if req.workspace_id and req.workspace_id != token_workspace_id and claims.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Cross-tenant workspace mismatch")

    async def event_generator():
        result = run_agent_cycle(
            agent_id=agent_id,
            message=req.message,
            conversation_id=req.conversation_id,
            workspace_id=token_workspace_id
        )

        yield f"event: stage\ndata: {json.dumps({'stage': 'INTENT_UNDERSTANDING', 'intent': result.get('intent')})}\n\n"
        await asyncio.sleep(0.02)

        if result.get("trace", {}).get("retrieved_citations"):
            yield f"event: stage\ndata: {json.dumps({'stage': 'RAG_RETRIEVAL', 'citations': len(result['trace']['retrieved_citations'])})}\n\n"
            await asyncio.sleep(0.02)

        full_text = result.get("response", "")
        words = full_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"event: token\ndata: {json.dumps({'token': chunk})}\n\n"
            await asyncio.sleep(0.015)

        yield f"event: done\ndata: {json.dumps(result)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/v1/rag/query")
async def query_rag_pipeline(
    req: RAGQueryRequest,
    claims: dict[str, Any] = Depends(verify_service_jwt)
):
    token_workspace_id = claims["workspace_id"]
    if req.workspace_id and req.workspace_id != token_workspace_id and claims.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Cross-tenant workspace mismatch")

    try:
        from .rag import fetch_tenant_chunks_from_db
        chunks = await fetch_tenant_chunks_from_db(token_workspace_id)
        return execute_rag_pipeline(req.question, workspace_id=token_workspace_id, tenant_chunks=chunks, top_k=req.top_k or 3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/knowledge/ingest")
async def ingest_knowledge_endpoint(
    req: KnowledgeIngestRequest,
    claims: dict[str, Any] = Depends(verify_service_jwt),
    session: AsyncSession = Depends(get_db_session)
):
    token_workspace_id = claims["workspace_id"]
    if req.workspace_id and req.workspace_id != token_workspace_id and claims.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Cross-tenant workspace mismatch")

    target_ws = req.workspace_id or token_workspace_id

    # Split content into distinct paragraphs/chunks
    raw_chunks = [c.strip() for c in req.content.split("\n\n") if c.strip()]
    if not raw_chunks:
        raw_chunks = [req.content]

    chunks_data = []
    for rc in raw_chunks:
        chunks_data.append({
            "text": rc,
            "embedding": [0.0] * 128,
            "metadata": req.metadata or {}
        })

    repo = DatabaseRepository(session)
    doc = await repo.add_knowledge_doc_with_chunks(
        workspace_id=target_ws,
        title=req.title,
        content=req.content,
        chunks=chunks_data
    )
    return {
        "success": True,
        "document_id": doc.id,
        "title": doc.title,
        "chunks_created": len(chunks_data),
        "workspace_id": target_ws
    }

from .redis_service import check_rate_limit

@app.get("/api/v1/orders/{order_number}")
async def get_order_endpoint(
    order_number: str,
    request: Request,
    customer_email: str = Query(..., description="Customer email for verification"),
    claims: dict[str, Any] = Depends(verify_service_jwt)
):
    workspace_id = claims["workspace_id"]
    client_ip = request.client.host if request.client else "unknown_ip"
    rate_key = f"order_lookup:{workspace_id}:{client_ip}"
    allowed, retry_after = await check_rate_limit(rate_key, max_requests=10, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many order lookup attempts. Please wait {retry_after} seconds before retrying."
        )

    from .tools import _fetch_order_db
    order = await _fetch_order_db(workspace_id, order_number, customer_email)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_number}' not found with the provided email address.")
    return order

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
