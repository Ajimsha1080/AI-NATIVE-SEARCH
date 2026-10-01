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

export interface AIModeProduct {
  id: string;
  title: string;
  handle?: string;
  description: string;
  price: number;
  sale_price?: number;
  currency: string;
  category: string;
  subcategories?: string[];
  brand?: string;
  images: string[];
  in_stock: boolean;
  variants: Array<{
    id: string;
    title: string;
    price: number;
    in_stock: boolean;
    attributes?: Record<string, string>;
  }>;
  attributes: Record<string, string>;
  source_url?: string;
  score?: number;
}

export interface AIModeSearchPlan {
  original_query: string;
  intent: 'DISCOVERY' | 'RECOMMENDATION' | 'COMPARISON' | 'SIMILAR' | 'REFINEMENT' | 'INVENTORY' | 'POLICY' | 'GENERAL';
  semantic_query: string;
  extracted_filters: {
    category?: string;
    min_price?: number;
    max_price?: number;
    color?: string;
    size?: string;
    gender?: string;
    occasion?: string;
    brand?: string;
    in_stock_only?: boolean;
    custom_attributes?: Record<string, string>;
  };
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  pagination: {
    page: number;
    page_size: number;
  };
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
