import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.datetime.now(datetime.UTC)

class WorkspaceModel(Base):
    __tablename__ = "workspaces"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    tier = Column(String(50), default="ENTERPRISE")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    agents = relationship("AgentModel", back_populates="workspace", cascade="all, delete-orphan")
    products = relationship("ProductModel", back_populates="workspace", cascade="all, delete-orphan")
    orders = relationship("OrderModel", back_populates="workspace", cascade="all, delete-orphan")


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    role = Column(String(50), default="ADMIN")
    created_at = Column(DateTime, default=utcnow)


class WorkspaceMemberModel(Base):
    __tablename__ = "workspace_members"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), default="OWNER")
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        Index("idx_ws_member_tenant_user", "workspace_id", "user_id"),
    )


class AuthTokenModel(Base):
    __tablename__ = "auth_tokens"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    token_type = Column(String(32), nullable=False, index=True)  # VERIFY_EMAIL, RESET_PASSWORD
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        Index("idx_auth_token_lookup", "token_hash", "token_type"),
    )


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    workspace = relationship("WorkspaceModel", back_populates="agents")
    config = relationship("AgentConfigModel", uselist=False, back_populates="agent", cascade="all, delete-orphan")
    versions = relationship("AgentVersionModel", back_populates="agent", cascade="all, delete-orphan")
    policies = relationship("AgentPolicyModel", back_populates="agent", cascade="all, delete-orphan")
    conversations = relationship("ConversationModel", back_populates="agent", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_agent_tenant", "workspace_id", "id"),
    )


class AgentConfigModel(Base):
    __tablename__ = "agent_configs"

    id = Column(String(64), primary_key=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), unique=True, nullable=False)
    model = Column(String(100), default="sarvam-105b-conversations")
    temperature = Column(Float, default=0.7)
    system_prompt = Column(Text, nullable=False)
    tools_enabled = Column(JSON, default=list)
    rag_enabled = Column(Boolean, default=True)
    routing_rules = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    agent = relationship("AgentModel", back_populates="config")


class AgentVersionModel(Base):
    __tablename__ = "agent_versions"

    id = Column(String(64), primary_key=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    system_prompt = Column(Text, nullable=False)
    model = Column(String(100), nullable=False)
    changelog = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    agent = relationship("AgentModel", back_populates="versions")


class AgentPolicyModel(Base):
    __tablename__ = "agent_policies"

    id = Column(String(64), primary_key=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    max_tokens_per_session = Column(Integer, default=100000)
    rate_limit_rpm = Column(Integer, default=60)
    allowed_domains = Column(JSON, default=list)
    require_human_approval_over = Column(Float, default=500.0)

    agent = relationship("AgentModel", back_populates="policies")


class KnowledgeSourceModel(Base):
    __tablename__ = "knowledge_sources"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="DOCUMENTS")
    created_at = Column(DateTime, default=utcnow)

    documents = relationship("KnowledgeDocModel", back_populates="source", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_ks_tenant", "workspace_id", "id"),
    )


class KnowledgeDocModel(Base):
    __tablename__ = "knowledge_documents"

    id = Column(String(64), primary_key=True, index=True)
    source_id = Column(String(64), ForeignKey("knowledge_sources.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    source = relationship("KnowledgeSourceModel", back_populates="documents")
    chunks = relationship("KnowledgeChunkModel", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunkModel(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(64), primary_key=True, index=True)
    doc_id = Column(String(64), ForeignKey("knowledge_documents.id"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, default="ws_acme_corp", index=True)
    chunk_index = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    # Storing embedding as JSON float array (compatible with both SQLite and pgvector)
    embedding = Column(JSON, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

    document = relationship("KnowledgeDocModel", back_populates="chunks")

    __table_args__ = (
        Index("idx_chunk_tenant", "workspace_id", "id"),
    )


class ProductModel(Base):
    __tablename__ = "commerce_products"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    compare_at_price = Column(Float, nullable=True)
    stock = Column(Integer, default=50)
    category = Column(String(100), default="General", index=True)
    sku = Column(String(100), nullable=True, index=True)
    image_url = Column(String(500), nullable=True)
    images_json = Column(JSON, default=list)
    tags_json = Column(JSON, default=list)
    variants_json = Column(JSON, default=list)
    attributes_json = Column(JSON, default=dict)
    source_url = Column(String(500), nullable=True)
    in_stock = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    workspace = relationship("WorkspaceModel", back_populates="products")

    __table_args__ = (
        Index("idx_prod_tenant_id", "workspace_id", "id"),
        Index("idx_prod_tenant_cat", "workspace_id", "category"),
        Index("idx_prod_tenant_sku", "workspace_id", "sku"),
    )


class OrderModel(Base):
    __tablename__ = "commerce_orders"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    order_number = Column(String(100), nullable=False, index=True)
    customer_id = Column(String(64), nullable=True)
    customer_name = Column(String(255), default="Valued Customer")
    customer_email = Column(String(255), nullable=False, index=True)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="PAID")
    payment_status = Column(String(50), default="PAID")
    fulfillment_status = Column(String(50), default="UNFULFILLED")
    shipping_address = Column(Text, nullable=True)
    tracking_number = Column(String(100), nullable=True)
    carrier = Column(String(100), default="Bluedart Express")
    items_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    workspace = relationship("WorkspaceModel", back_populates="orders")

    __table_args__ = (
        Index("idx_order_tenant_number", "workspace_id", "order_number"),
        Index("idx_order_tenant_email", "workspace_id", "customer_email"),
    )


class CartModel(Base):
    __tablename__ = "commerce_carts"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), default="ws_acme_corp", index=True)
    session_id = Column(String(128), unique=True, index=True, nullable=False)
    items_json = Column(JSON, default=list)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class DeploymentModel(Base):
    __tablename__ = "deployments"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="LIVE")
    allowed_domains = Column(JSON, default=list)
    theme_json = Column(JSON, default=dict)
    branding_json = Column(JSON, default=dict)
    embed_code = Column(Text, nullable=True)
    total_conversations = Column(Integer, default=0)
    total_product_clicks = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class AIModeConfigModel(Base):
    __tablename__ = "ai_mode_configs"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), unique=True, nullable=False, index=True)
    enabled = Column(Boolean, default=True)
    model_provider = Column(String(50), default="sarvam")
    model_name = Column(String(100), default="sarvam-105b-conversations")
    temperature = Column(Float, default=0.3)
    retrieval_threshold = Column(Float, default=0.25)
    max_search_results = Column(Integer, default=6)
    enable_recommendations = Column(Boolean, default=True)
    enable_comparisons = Column(Boolean, default=True)
    enable_cart_actions = Column(Boolean, default=True)
    system_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class ConversationModel(Base):
    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, default="ws_acme_corp", index=True)
    user_id = Column(String(64), nullable=True)
    title = Column(String(255), default="New Session")
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    agent = relationship("AgentModel", back_populates="conversations")
    messages = relationship("MessageModel", back_populates="conversation", cascade="all, delete-orphan")


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(String(64), primary_key=True, index=True)
    conversation_id = Column(String(64), ForeignKey("conversations.id"), nullable=False, index=True)
    sender = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

    conversation = relationship("ConversationModel", back_populates="messages")


class ExecutionTraceModel(Base):
    __tablename__ = "execution_traces"

    id = Column(String(64), primary_key=True, index=True)
    agent_id = Column(String(64), index=True, nullable=False)
    conversation_id = Column(String(64), index=True, nullable=True)
    duration_ms = Column(Float, default=0.0)
    rag_steps_executed = Column(Integer, default=12)
    tools_called = Column(JSON, default=list)
    status = Column(String(50), default="SUCCESS")
    trace_log = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)


class ToolModel(Base):
    __tablename__ = "tools"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), default="commerce")
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True)


class IntegrationModel(Base):
    __tablename__ = "integrations"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    provider = Column(String(100), nullable=False)
    status = Column(String(50), default="CONNECTED")
    config_json = Column(JSON, default=dict)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), nullable=False, default="ws_acme_corp", index=True)
    action = Column(String(100), nullable=False, index=True)
    actor_id = Column(String(64), nullable=False)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(128), nullable=True)
    ip_address = Column(String(64), nullable=True)
    details_json = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=utcnow)

    __table_args__ = (
        Index("idx_audit_tenant_time", "workspace_id", "timestamp"),
        Index("idx_audit_tenant_action", "workspace_id", "action"),
    )
