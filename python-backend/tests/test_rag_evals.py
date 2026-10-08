import pytest

from app.rag import (
    execute_rag_pipeline,
    generate_embedding,
    hybrid_retrieve,
    rewrite_query,
    understand_query,
    verify_grounding,
)

MOCK_CHUNKS_WORKSPACE_A = [
    {
        "chunk_id": "chunk_ret_001",
        "workspace_id": "ws_alpha",
        "doc_name": "Refund & Return Policy",
        "content": "Customers can return unused items within 30 days of delivery for a full refund to the original payment method.",
        "embedding": generate_embedding("Customers can return unused items within 30 days of delivery for a full refund to the original payment method.")
    },
    {
        "chunk_id": "chunk_ship_002",
        "workspace_id": "ws_alpha",
        "doc_name": "Shipping & Logistics",
        "content": "Standard ground shipping takes 3-5 business days across India via BlueDart and Delhivery.",
        "embedding": generate_embedding("Standard ground shipping takes 3-5 business days across India via BlueDart and Delhivery.")
    },
    {
        "chunk_id": "chunk_size_003",
        "workspace_id": "ws_alpha",
        "doc_name": "Sizing Guide",
        "content": "For oversized hoodies and streetwear, size down for a standard regular fit.",
        "embedding": generate_embedding("For oversized hoodies and streetwear, size down for a standard regular fit.")
    }
]

MOCK_CHUNKS_WORKSPACE_B = [
    {
        "chunk_id": "chunk_secret_999",
        "workspace_id": "ws_beta",
        "doc_name": "Confidential Tenant B Document",
        "content": "Tenant B proprietary manufacturing specifications and internal margins.",
        "embedding": generate_embedding("Tenant B proprietary manufacturing specifications and internal margins.")
    }
]

def test_rag_intent_understanding_and_rewriting():
    question = "How many days do I have to return my jacket?"
    understanding = understand_query(question)
    assert understanding["detected_intent"] == "RETURN_OR_POLICY_INQUIRY"
    assert understanding["extracted_entities"].get("product_category") == "apparel"

    rewrite = rewrite_query(question, understanding)
    assert "return" in rewrite["rewritten_query"].lower()
    assert len(rewrite["expansion_terms"]) > 0

def test_rag_retrieval_accuracy():
    """Verify that a return query correctly prioritizes the return policy chunk."""
    res = execute_rag_pipeline(
        question="What is the return window for items?",
        workspace_id="ws_alpha",
        tenant_chunks=MOCK_CHUNKS_WORKSPACE_A
    )
    assert len(res["citations"]) > 0
    top_citation = res["citations"][0]
    assert top_citation["document_name"] == "Refund & Return Policy"
    assert "30 days" in top_citation["chunk_text"]
    assert res["grounding_verification"]["is_grounded"] is True

def test_rag_grounding_and_hallucination_detection():
    """Verify grounding check approves factual answers and rejects hallucinations."""
    context = "Customers can return unused items within 30 days of delivery for a full refund."

    grounded_answer = "According to our store policy, customers can return unused items within 30 days of delivery."
    grounded_eval = verify_grounding(grounded_answer, context, has_retrieved_chunks=True)
    assert grounded_eval["is_grounded"] is True
    assert grounded_eval["confidence_score"] >= 0.65

    hallucinated_answer = "We provide unlimited lifetime replacements with rocket delivery to the planet Mars."
    hallucinated_eval = verify_grounding(hallucinated_answer, context, has_retrieved_chunks=True)
    assert hallucinated_eval["is_grounded"] is False

def test_rag_tenant_isolation_boundary():
    """Verify tenant isolation enforcement at RAG pipeline level."""
    # Empty workspace must raise ValueError
    with pytest.raises(ValueError):
        execute_rag_pipeline("Any query", workspace_id="")

    # Tenant Alpha should never retrieve Tenant Beta chunks
    dense_hits, sparse_hits = hybrid_retrieve(
        query="confidential proprietary specifications",
        workspace_id="ws_alpha",
        tenant_chunks=MOCK_CHUNKS_WORKSPACE_A
    )
    all_hit_ids = [h["chunk_id"] for h in dense_hits + sparse_hits]
    assert "chunk_secret_999" not in all_hit_ids


import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.db.database import async_session_factory
from app.db.models import DeploymentModel, KnowledgeChunkModel, KnowledgeDocModel, KnowledgeSourceModel
from app.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_chat_retrieves_store_policy_context_and_includes_in_prompt():
    """Verify Issue 2: Knowledge doc 'Returns accepted within 7 days' is retrieved,

    included in the LLM prompt, returned in citations, and handled when LLM is unconfigured.
    """
    ws = f"ws_policy_{uuid.uuid4().hex[:8]}"
    dep_key = f"dep_policy_{uuid.uuid4().hex[:8]}"
    source_id = f"src_{uuid.uuid4().hex[:8]}"
    doc_id = f"doc_{uuid.uuid4().hex[:8]}"
    chunk_id = f"chunk_{uuid.uuid4().hex[:8]}"

    async with async_session_factory() as session:
        dep = DeploymentModel(
            id=f"dep_{uuid.uuid4().hex[:8]}",
            workspace_id=ws,
            name="Policy Chat Test",
            status="LIVE",
            public_key=dep_key
        )
        source = KnowledgeSourceModel(
            id=source_id,
            workspace_id=ws,
            name="Store Policies",
            type="MANUAL"
        )
        doc = KnowledgeDocModel(
            id=doc_id,
            source_id=source_id,
            title="Return Policy Document",
            content="Returns accepted within 7 days of delivery in original condition."
        )
        chunk = KnowledgeChunkModel(
            id=chunk_id,
            doc_id=doc_id,
            workspace_id=ws,
            text="Returns accepted within 7 days of delivery in original condition."
        )
        session.add_all([dep, source, doc, chunk])
        await session.commit()

    captured_prompt = None

    def mock_call_model(self, messages, tools=None):
        nonlocal captured_prompt
        captured_prompt = messages[0]["content"]
        return {"response": "Our return policy accepts returns within 7 days of delivery."}

    # 1. Test with LLM configured & mocked
    with patch("app.llm.LLMClient.is_configured", return_value=True), \
         patch("app.llm.LLMClient.call_model", side_effect=mock_call_model, autospec=True):

        res = client.post(
            "/api/v1/ai-mode/chat",
            headers={"X-Deployment-Key": dep_key},
            json={"user_message": "what is your return policy?"}
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data["citations"]) > 0
        assert data["citations"][0]["document_name"] == "Return Policy Document"
        assert "Returns accepted within 7 days" in data["citations"][0]["chunk_text"]
        assert captured_prompt is not None
        assert "Returns accepted within 7 days" in captured_prompt

    # 2. Test when LLM key is NOT configured -> returns clear message + policy text
    with patch("app.llm.LLMClient.is_configured", return_value=False):
        res_unconf = client.post(
            "/api/v1/ai-mode/chat",
            headers={"X-Deployment-Key": dep_key},
            json={"user_message": "what is your return policy?"}
        )
        assert res_unconf.status_code == 200
        data_unconf = res_unconf.json()
        assert "AI answers are not configured" in data_unconf["content"]
        assert "Returns accepted within 7 days" in data_unconf["content"]
        assert len(data_unconf["citations"]) > 0

