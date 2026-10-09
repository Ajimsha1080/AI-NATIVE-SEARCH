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
    return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)

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
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(128), nullable=True)
    mfa_recovery_codes = Column(JSON, default=list, nullable=False)
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


from pgvector.sqlalchemy import Vector
from sqlalchemy.types import TypeDecorator


class PgVectorEmbedding(TypeDecorator):
    """Stores high-dimensional embedding vectors.
    Uses pgvector Vector in PostgreSQL; falls back to JSON float list in SQLite/other dialects.
    """
    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = 1536, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(JSON())


class KnowledgeChunkModel(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(64), primary_key=True, index=True)
    doc_id = Column(String(64), ForeignKey("knowledge_documents.id"), nullable=False, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    chunk_index = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    # Stored via pgvector Vector(1536) in PostgreSQL, JSON in SQLite
    embedding = Column(PgVectorEmbedding(1536), nullable=True)
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
    carrier = Column(String(100), nullable=True)
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
    workspace_id = Column(String(64), nullable=False, index=True)
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
    public_key = Column(String(128), unique=True, index=True, nullable=True)
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
    workspace_id = Column(String(64), nullable=False, index=True)
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
    workspace_id = Column(String(64), nullable=False, index=True)
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


class IdempotencyKeyModel(Base):
    __tablename__ = "idempotency_keys"

    id = Column(String(128), primary_key=True, index=True)
    workspace_id = Column(String(64), nullable=False, index=True)
    response_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        Index("idx_idempotency_tenant_id", "workspace_id", "id"),
    )


class SyncJobModel(Base):
    __tablename__ = "sync_jobs"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    connector_type = Column(String(64), nullable=False, index=True)
    status = Column(String(32), default="PENDING", index=True)
    synced_items_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_sync_job_tenant", "workspace_id", "status"),
    )


class PlanModel(Base):
    __tablename__ = "billing_plans"

    code = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    price = Column(Float, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    interval = Column(String(32), default="monthly", nullable=False)
    description = Column(Text, nullable=True)
    limits_json = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class SubscriptionModel(Base):
    __tablename__ = "billing_subscriptions"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    plan_code = Column(String(64), ForeignKey("billing_plans.code"), nullable=False, index=True)
    status = Column(String(32), default="TRIALING", index=True, nullable=False)
    current_period_start = Column(DateTime, default=utcnow, nullable=False)
    current_period_end = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    grace_period_end = Column(DateTime, nullable=True)
    provider = Column(String(32), default="razorpay", nullable=False)
    provider_customer_id = Column(String(128), nullable=True)
    provider_subscription_id = Column(String(128), nullable=True, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_sub_workspace", "workspace_id"),
        Index("idx_sub_tenant_status", "workspace_id", "status"),
        Index("idx_sub_provider_id", "provider_subscription_id"),
    )


class InvoiceModel(Base):
    __tablename__ = "billing_invoices"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    subscription_id = Column(String(64), ForeignKey("billing_subscriptions.id"), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    status = Column(String(32), default="PAID", index=True, nullable=False)
    invoice_pdf_url = Column(String(512), nullable=True)
    provider_invoice_id = Column(String(128), nullable=True, index=True)
    provider_payment_id = Column(String(128), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    billing_period_start = Column(DateTime, nullable=True)
    billing_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_invoice_workspace", "workspace_id"),
        Index("idx_invoice_tenant_date", "workspace_id", "created_at"),
        Index("idx_invoice_provider_id", "provider_invoice_id"),
    )


class BillingWebhookEventModel(Base):
    __tablename__ = "billing_webhook_events"

    id = Column(String(64), primary_key=True)
    provider = Column(String(32), nullable=False)
    event_id = Column(String(128), unique=True, index=True, nullable=False)
    event_type = Column(String(128), nullable=False, index=True)
    payload_json = Column(JSON, nullable=False)
    processed_at = Column(DateTime, default=utcnow, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_billing_wh_event_id", "event_id", unique=True),
        Index("idx_billing_wh_type", "event_type"),
    )


class UsageRecordModel(Base):
    __tablename__ = "billing_usage_records"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    period_month = Column(String(7), nullable=False)  # 'YYYY-MM'
    search_requests = Column(Integer, default=0, nullable=False)
    chat_requests = Column(Integer, default=0, nullable=False)
    tokens_in = Column(Integer, default=0, nullable=False)
    tokens_out = Column(Integer, default=0, nullable=False)
    estimated_cost_usd = Column(Float, default=0.0, nullable=False)
    crawl_runs = Column(Integer, default=0, nullable=False)
    alert_80_sent = Column(Boolean, default=False, nullable=False)
    alert_100_sent = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_usage_workspace", "workspace_id"),
        Index("idx_usage_ws_month", "workspace_id", "period_month", unique=True),
    )


class WorkspaceInvitationModel(Base):
    __tablename__ = "workspace_invitations"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(32), default="VIEWER", nullable=False)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    invited_by_user_id = Column(String(64), ForeignKey("users.id"), nullable=False)
    status = Column(String(32), default="PENDING", nullable=False)  # PENDING, ACCEPTED, REVOKED, EXPIRED
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_invite_workspace", "workspace_id"),
        Index("idx_invite_email", "email"),
        Index("idx_invite_token_hash", "token_hash", unique=True),
        Index("idx_invite_ws_status", "workspace_id", "status"),
    )


class ApiKeyModel(Base):
    __tablename__ = "api_keys"

    id = Column(String(64), primary_key=True, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=False, index=True)
    created_by_user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    key_prefix = Column(String(16), nullable=False)
    key_hash = Column(String(128), unique=True, index=True, nullable=False)
    scopes = Column(JSON, default=list, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_api_keys_workspace", "workspace_id"),
        Index("idx_api_keys_hash", "key_hash", unique=True),
    )


class UserSessionModel(Base):
    __tablename__ = "user_sessions"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    workspace_id = Column(String(64), ForeignKey("workspaces.id"), nullable=True, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_activity_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("idx_user_sessions_user", "user_id"),
        Index("idx_user_sessions_active", "user_id", "is_revoked"),
    )
