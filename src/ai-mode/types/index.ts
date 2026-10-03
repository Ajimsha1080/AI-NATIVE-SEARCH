export interface AIModeConfig {
  id: string;
  workspace_id: string;
  enabled: boolean;
  model_provider: 'sarvam' | 'openai' | 'anthropic' | 'ollama';
  model_name: string;
  temperature: number;
  retrieval_threshold: number;
  max_search_results: number;
  enable_recommendations: boolean;
  enable_comparisons: boolean;
  enable_cart_actions: boolean;
  system_instructions: string;
  created_at: string;
  updated_at: string;
}

export interface AIModeKnowledgeSource {
  id: string;
  workspace_id: string;
  name: string;
  type: 'WEBSITE' | 'DOCUMENT' | 'FAQ' | 'CSV' | 'CUSTOM';
  source_url?: string;
  status: 'INDEXED' | 'INDEXING' | 'ERROR' | 'IDLE';
  document_count: number;
  product_count: number;
  last_synced_at?: string;
  error_message?: string;
  raw_content?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AIModeProductVariant {
  id: string;
  parent_product_id?: string;
  title: string;
  price: number;
  sale_price?: number;
  in_stock: boolean;
  sku?: string;
  images?: string[];
  attributes?: Record<string, string>;
}

export interface AIModeProduct {
  id: string;
  title: string;
  handle?: string;
  description: string;
  product_type?: string;
  price: number;
  sale_price?: number;
  currency: string;
  category: string;
  subcategories?: string[];
  brand?: string;
  audience?: 'men' | 'women' | 'unisex' | 'kids' | string;
  images: string[];
  in_stock: boolean;
  variants: AIModeProductVariant[];
  attributes: Record<string, string>;
  tags?: string[];
  searchable_text?: string;
  source_url?: string;
  score?: number;
}

export type SearchConstraintOperator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'BETWEEN';

export interface SearchConstraint {
  field: string;
  operator: SearchConstraintOperator;
  value: any;
  is_hard: boolean;
  is_variant_level: boolean;
  confidence?: number;
  raw_token?: string;
}

export interface AIModeSearchPlan {
  original_query: string;
  intent: 'DISCOVERY' | 'EXACT_MATCH' | 'RECOMMENDATION' | 'COMPARISON' | 'SIMILAR' | 'REFINEMENT' | 'INVENTORY' | 'POLICY' | 'GENERAL';
  product_concepts: string[];
  hard_constraints: SearchConstraint[];
  soft_preferences: string[];
  semantic_query: string;
  lexical_query: string;
  exclusions: string[];
  sorting?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  pagination: {
    page: number;
    page_size: number;
  };
  confidence: number;
  extracted_filters: {
    category?: string;
    product_type?: string;
    min_price?: number;
    max_price?: number;
    color?: string;
    size?: string;
    gender?: string;
    audience?: string;
    occasion?: string;
    brand?: string;
    material?: string;
    in_stock_only?: boolean;
    exclusions?: string[];
    custom_attributes?: Record<string, string>;
  };
}

export interface SearchDiagnosticRecord {
  total_catalog_count: number;
  candidate_count: number;
  valid_count: number;
  rejections?: Array<{
    product_id: string;
    title: string;
    failed_constraint: string;
    reason: string;
  }>;
  relaxed_constraints?: string[];
}

export interface AIModeSearchResult {
  products: AIModeProduct[];
  total_matches: number;
  page: number;
  page_size: number;
  has_more: boolean;
  applied_filters: Record<string, any>;
  search_plan: AIModeSearchPlan;
  latency_ms: number;
  diagnostics?: SearchDiagnosticRecord;
}

export interface AIModeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  products?: AIModeProduct[];
  comparison?: {
    item_a: AIModeProduct;
    item_b: AIModeProduct;
    pros_a: string[];
    pros_b: string[];
    summary: string;
  };
  recommendations?: AIModeProduct[];
  cart_action_performed?: {
    action: 'ADD' | 'REMOVE' | 'VIEW';
    product_title: string;
    quantity: number;
  };
  created_at: string;
}

export interface AIModeConversation {
  id: string;
  workspace_id: string;
  messages: AIModeMessage[];
  last_search_state?: AIModeSearchPlan;
  created_at: string;
  updated_at: string;
}

export interface AIModeDeployment {
  id: string;
  workspace_id: string;
  name: string;
  status: 'LIVE' | 'PAUSED' | 'DRAFT';
  allowed_domains: string[];
  theme: {
    primary_color: string;
    background_color: string;
    text_color: string;
    border_radius: 'sm' | 'md' | 'lg' | 'full';
    font_family: string;
  };
  branding: {
    title: string;
    subtitle: string;
    logo_url?: string;
    welcome_message: string;
    suggested_prompts: string[];
    position: 'bottom-right' | 'bottom-left';
  };
  embed_code: string;
  total_conversations: number;
  total_product_clicks: number;
  created_at: string;
  updated_at: string;
}
