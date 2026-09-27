export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  is_super_admin?: boolean;
  email_verified?: boolean;
  verification_token?: string;
  verification_token_expires_at?: string;
  reset_password_token?: string;
  reset_password_expires_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  created_at: string;
  updated_at: string;
  settings?: {
    retention_days?: number;
    security?: {
      rate_limit_rpm?: number;
      allowed_origins?: string[];
      require_mfa?: boolean;
    };
  };
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  industry: string;
  primary_objective: string;
  language: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  current_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  id: string;
  agent_id: string;
  identity: {
    name: string;
    avatar_url: string;
    brand_name: string;
    description: string;
    greeting: string;
    language: string;
  };
  personality: {
    tone: 'friendly' | 'professional' | 'concise' | 'detailed' | 'persuasive' | 'casual';
    enthusiasm_level: number;
    creativity_level: number;
    formality_level: number;
    custom_persona_prompt?: string;
  };
  instructions: {
    system_prompt: string;
    custom_rules: string[];
    anti_injection_rules: string[];
    fallback_response: string;
  };
  appearance: {
    theme_preset?: string;
    theme_mode?: string;
    primary_color: string;
    background_color: string;
    text_color: string;
    launcher_icon: string;
    position: 'bottom-right' | 'bottom-left';
    widget_title: string;
    show_branding: boolean;
    custom_css?: string;
  };
  starter_questions?: string[];
  memory: {
    enabled: boolean;
    session_memory: boolean;
    customer_preferences: boolean;
    retention_days: number;
  };
  capabilities?: Record<string, boolean>;
  goals: string[];
  updated_at: string;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version_number: string;
  status: 'PUBLISHED' | 'ARCHIVED' | 'ROLLBACK';
  config_snapshot: AgentConfig;
  tools_snapshot: ToolPermission[];
  policies_snapshot: AgentPolicy[];
  change_summary: string;
  published_by_user_id: string;
  created_at: string;
}

export interface AgentPolicy {
  id: string;
  agent_id: string;
  workspace_id: string;
  title: string;
  description: string;
  type: 'STOCK_GUARD' | 'DISCOUNT_CAP' | 'REFUND_APPROVAL' | 'PROMPT_INJECTION' | 'CUSTOM';
  condition: string;
  enforcement: 'BLOCK' | 'REQUIRE_CUSTOMER_CONFIRMATION' | 'REQUIRE_HUMAN_APPROVAL' | 'ESCALATE';
  is_active: boolean;
  created_at: string;
}

export interface Tool {
  id: string;
  name: string;
  category: 'CATALOG' | 'ORDER' | 'CART' | 'CUSTOMER' | 'SUPPORT';
  description: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  input_schema: any;
  output_schema: any;
}

export interface ToolPermission {
  id: string;
  agent_id: string;
  tool_id: string;
  is_enabled: boolean;
  permission_mode: 'ALLOWED' | 'DISABLED' | 'REQUIRES_CONFIRMATION' | 'REQUIRES_APPROVAL';
  custom_risk_override?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface KnowledgeSource {
  id: string;
  workspace_id: string;
  agent_id?: string;
  name: string;
  source_type: 'FILE' | 'URL' | 'TEXT';
  url?: string;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  workspace_id: string;
  agent_id?: string;
  source_id?: string;
  name: string;
  type: 'PDF' | 'TXT' | 'DOCX' | 'CSV' | 'MARKDOWN' | 'URL' | 'TEXT';
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
  size_bytes: number;
  chunk_count: number;
  raw_content?: string;
  processing_error?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  workspace_id: string;
  agent_id?: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata: {
    source_name: string;
    section_title?: string;
    token_count?: number;
    [key: string]: any;
  };
  created_at: string;
}

export interface CommerceProductVariant {
  id: string;
  title: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  inventory_quantity: number;
  attributes: Record<string, string>;
}

export interface CommerceProduct {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  compare_at_price?: number;
  currency: string;
  images: string[];
  in_stock: boolean;
  total_inventory: number;
  variants: CommerceProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface CommerceOrder {
  id: string;
  workspace_id: string;
  order_number: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  total_amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  payment_status: 'PAID' | 'PENDING' | 'FAILED';
  fulfillment_status: 'UNFULFILLED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';
  shipping_address: string;
  tracking_number?: string;
  carrier?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface CommerceCart {
  id: string;
  workspace_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    title: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  coupon_code?: string;
  discount_amount: number;
  subtotal: number;
  total: number;
  currency: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  workspace_id: string;
  provider: 'SHOPIFY' | 'WOOCOMMERCE' | 'CUSTOM_REST' | 'CUSTOM_GRAPHQL' | 'CSV_CATALOG';
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';
  last_synced_at?: string;
  sync_stats?: {
    products_synced: number;
    orders_synced: number;
    errors: number;
  };
  config: Record<string, any>;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  agent_id: string;
  agent_version_id?: string;
  channel: 'WEBSITE' | 'MOBILE' | 'API' | 'PLAYGROUND' | 'CUSTOM';
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
  customer_identifier: string;
  customer_name?: string;
  customer_email?: string;
  escalation_reason?: string;
  assigned_human_user_id?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  workspace_id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL' | 'HUMAN';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  interactive_payload?: {
    type: 'PRODUCTS' | 'ORDER_TRACKING' | 'CONFIRMATION' | 'QUICK_REPLIES' | 'CART_SUMMARY';
    data: any;
  };
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ExecutionTrace {
  id: string;
  conversation_id: string;
  message_id: string;
  agent_id: string;
  workspace_id: string;
  intent: string;
  goal: string;
  planning_steps: string[];
  tool_executions: Array<{
    tool_name: string;
    input: any;
    output: any;
    status: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'CONFIRMATION_REQUIRED';
    latency_ms: number;
  }>;
  retrieved_citations: Array<{
    document_name: string;
    chunk_text: string;
    relevance_score: number;
    is_verified?: boolean;
  }>;
  rag_pipeline?: {
    query_understanding?: {
      detected_intent: string;
      extracted_entities: Record<string, any>;
    };
    query_rewrite?: {
      original_query: string;
      rewritten_query: string;
      expansion_terms: string[];
    };
    hybrid_retrieval?: {
      dense_hits: number;
      sparse_hits: number;
    };
    rrf_fusion?: {
      fused_candidates: number;
      rrf_constant: number;
    };
    reranking?: {
      candidates_scored: number;
      top_score: number;
    };
    context_assembly?: {
      tokens_assembled: number;
      chunks_used: number;
    };
    grounding_verification?: {
      is_grounded: boolean;
      confidence_score: number;
      unsupported_claims: string[];
      verified_facts_count: number;
    };
  };
  policies_evaluated: Array<{
    policy_title: string;
    enforcement: string;
    passed: boolean;
  }>;
  latency_ms: number;
  tokens_used: {
    input: number;
    output: number;
    total: number;
  };
  created_at: string;
}

export interface Deployment {
  id: string;
  workspace_id: string;
  agent_id: string;
  agent_version_id: string;
  channel: 'WEBSITE' | 'MOBILE_SDK' | 'REST_API' | 'CUSTOM';
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  public_key: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  hashed_key: string;
  permissions: string[];
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface Webhook {
  id: string;
  workspace_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  workspace_id: string;
  event: string;
  payload: any;
  status_code?: number;
  response_body?: string;
  delivery_status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRYING';
  latency_ms?: number;
  created_at: string;
}

export interface EvaluationCase {
  id: string;
  agent_id: string;
  workspace_id: string;
  name: string;
  user_input: string;
  expected_intent: string;
  expected_tools: string[];
  expected_knowledge_source?: string;
  expected_keywords: string[];
  created_at: string;
}

export interface EvaluationRun {
  id: string;
  agent_id: string;
  agent_version_id: string;
  workspace_id: string;
  total_cases: number;
  passed_cases: number;
  task_success_rate: number;
  tool_accuracy_rate: number;
  knowledge_accuracy_rate: number;
  avg_latency_ms: number;
  results: Array<{
    case_id: string;
    case_name: string;
    input: string;
    actual_intent: string;
    actual_tools: string[];
    actual_response: string;
    passed: boolean;
    score: number;
    error_reason?: string;
  }>;
  metrics?: {
    task_success_rate_pct: number;
    tool_selection_accuracy_pct: number;
    knowledge_attribution_pct: number;
    avg_latency_ms: number;
  };
  created_at: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  actor_user_id?: string;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  workspace_id: string;
  event_type: 'MESSAGE' | 'CHUNK_EMBED' | 'AGENT_EXECUTION' | 'API_CALL';
  quantity: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ProcessedWebhookEvent {
  id: string;
  event_id: string;
  provider: 'STRIPE' | 'RAZORPAY' | 'SHOPIFY';
  processed_at: string;
}
