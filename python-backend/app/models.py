from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ChatRequest(BaseModel):
    message: str = Field(..., description="User question or prompt")
    conversation_id: Optional[str] = None
    workspace_id: Optional[str] = None
    customer_identifier: Optional[str] = "guest_user"
    channel: Optional[str] = "PLAYGROUND"

class RAGQueryRequest(BaseModel):
    question: str = Field(..., description="Query for knowledge retrieval")
    workspace_id: Optional[str] = None
    top_k: Optional[int] = 3
    min_score: Optional[float] = 0.20

class KnowledgeIngestRequest(BaseModel):
    title: str = Field(..., description="Document title")
    content: str = Field(..., description="Raw text content to chunk and index")
    workspace_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class Citation(BaseModel):
    document_name: str
    chunk_text: str
    relevance_score: float
    is_verified: bool = True

class RAGPipelineTrace(BaseModel):
    query_understanding: Dict[str, Any]
    query_rewrite: Dict[str, Any]
    hybrid_retrieval: Dict[str, Any]
    rrf_fusion: Dict[str, Any]
    reranking: Dict[str, Any]
    context_assembly: Dict[str, Any]
    grounding_verification: Dict[str, Any]

class ExecutionTrace(BaseModel):
    id: str
    conversation_id: str
    agent_id: str
    intent: str
    planning_steps: List[str]
    tool_executions: List[Dict[str, Any]]
    retrieved_citations: List[Citation]
    rag_pipeline: Optional[RAGPipelineTrace] = None
    latency_ms: int

class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    response: str
    interactive_payload: Optional[Dict[str, Any]] = None
    trace: ExecutionTrace
