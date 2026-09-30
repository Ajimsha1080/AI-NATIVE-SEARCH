import { CommerceProduct } from '@/types';

export interface AiModeConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  confidence_threshold: number;
  system_instructions?: string;
  enable_comparisons: boolean;
  enable_recommendations: boolean;
  enable_cart_actions: boolean;
  updated_at: string;
}

export type AiModeKnowledgeType = 'WEBSITE_URL' | 'FILE_UPLOAD' | 'FAQ' | 'BUSINESS_INFO';

export interface AiModeKnowledgeSource {
  id: string;
  workspace_id: string;
  type: AiModeKnowledgeType;
  name: string;
  url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  content_preview?: string;
  status: 'READY' | 'SYNCING' | 'FAILED' | 'PAUSED';
  document_count: number;
  product_count: number;
  last_synced_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AiModeDeployment {
  id: string;
  workspace_id: string;
  name: string;
  status: 'LIVE' | 'PAUSED' | 'DRAFT';
  allowed_domains: string[];
  theme: {
    primary_color: string;
    theme_mode: 'light' | 'dark' | 'auto';
    position: 'bottom-right' | 'bottom-left';
    launcher_style: 'bubble' | 'pill' | 'minimal';
    launcher_text: string;
    widget_title: string;
    welcome_message: string;
    placeholder_text: string;
    starter_prompts: string[];
    show_branding: boolean;
    custom_css?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface AiModeSearchPlan {
  intent: 'SEARCH' | 'COMPARE' | 'RECOMMEND' | 'REFINE' | 'PAGINATE' | 'INVENTORY' | 'POLICY' | 'GENERAL';
  scope: 'all_matching' | 'recommendations' | 'specific_product' | 'similar' | 'refinement' | 'pagination';
  semantic_query: string;
  extracted_keywords: string[];
  category?: string;
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  min_price?: number;
  max_price?: number;
  color?: string;
  brand?: string;
  material?: string;
  occasion?: string;
  style?: string;
  sort?: 'price_asc' | 'price_desc' | 'relevance' | 'newest';
  page: number;
  page_size: number;
}

export interface AiModeSearchResult {
  query: string;
  plan: AiModeSearchPlan;
  products: CommerceProduct[];
  total_matches: number;
  page: number;
  page_size: number;
  has_more: boolean;
  confidence_score: number;
  retrieval_diagnostics: {
    lexical_candidates_count: number;
    vector_candidates_count: number;
    combined_candidates_count: number;
    fallback_applied: boolean;
    latency_ms: number;
  };
}

export interface AiModeComparisonResult {
  products: CommerceProduct[];
  comparison_points: {
    attribute: string;
    values: Record<string, string | number | boolean>;
  }[];
  summary: string;
}

export interface AiModeChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  products?: CommerceProduct[];
  comparison?: AiModeComparisonResult;
  pagination?: {
    page: number;
    pageSize: number;
    totalMatches: number;
    hasMore: boolean;
  };
  suggested_actions?: string[];
}

export interface AiModeConversation {
  id: string;
  workspace_id: string;
  session_id: string;
  messages: AiModeChatMessage[];
  context: {
    last_search_plan?: AiModeSearchPlan;
    last_products?: CommerceProduct[];
    active_filters?: Record<string, any>;
    cart_items?: { productId: string; quantity: number; title: string; price: number }[];
  };
  created_at: string;
  updated_at: string;
}
