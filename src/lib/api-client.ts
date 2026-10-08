/**
 * Typed API Client for ShopMate AaaS Python FastAPI Backend
 * Auto-configured for proxy rewrites and typed client integration
 */

export interface ProductVariant {
  id: string;
  sku?: string;
  title: string;
  price: number;
  inventory_quantity?: number;
  attributes?: Record<string, any>;
}

export interface Product {
  id: string;
  workspace_id?: string;
  title: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  category: string;
  sku?: string;
  images: string[];
  variants: ProductVariant[];
  tags: string[];
  attributes?: Record<string, any>;
  in_stock: boolean;
  total_inventory?: number;
  source_url?: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  categories: string[];
}

export interface AISearchResponse {
  products: Product[];
  total_matches: number;
  page: number;
  page_size: number;
  has_more: boolean;
  applied_filters: Record<string, any>;
  latency_ms: number;
}

export interface AIChatResponse {
  conversation_id: string;
  workspace_id: string;
  role: string;
  content: string;
  products: Product[];
  recommendations?: Product[];
  created_at: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
    is_super_admin: boolean;
    workspaceName: string;
  } | null;
  workspace?: any;
  role?: string;
}

class ShopMateApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.detail || err.message || `API request failed with status ${res.status}`);
    }

    return res.json();
  }

  // --- Commerce Products ---
  public async getProducts(params?: { category?: string; query?: string; in_stock?: boolean }): Promise<ProductsResponse> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.query) q.set('query', params.query);
    if (params?.in_stock !== undefined) q.set('in_stock', String(params.in_stock));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.fetch<ProductsResponse>(`/api/commerce/products${qs}`);
  }

  // --- AI Mode Search & Chat ---
  public async searchAI(query: string, workspaceId: string = 'ws_acme_corp'): Promise<AISearchResponse> {
    return this.fetch<AISearchResponse>('/api/ai-mode/search', {
      method: 'POST',
      body: JSON.stringify({ query, workspace_id: workspaceId })
    });
  }

  public async chatAI(message: string, conversationId?: string, workspaceId: string = 'ws_acme_corp'): Promise<AIChatResponse> {
    return this.fetch<AIChatResponse>('/api/ai-mode/chat', {
      method: 'POST',
      body: JSON.stringify({ user_message: message, conversation_id: conversationId, workspace_id: workspaceId })
    });
  }

  // --- Authentication ---
  public async getAuthMe(): Promise<AuthMeResponse> {
    return this.fetch<AuthMeResponse>('/api/auth/me');
  }

  public async login(email: string): Promise<any> {
    return this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public async logout(): Promise<any> {
    return this.fetch('/api/auth/logout', { method: 'POST' });
  }

  // --- DPDP Act Compliance & Auditing ---
  public async getAuditLogs(workspaceId: string = 'ws_acme_corp', limit: number = 50): Promise<any> {
    return this.fetch(`/api/v1/compliance/audit-logs?workspace_id=${encodeURIComponent(workspaceId)}&limit=${limit}`);
  }

  public async exportCustomerData(customerEmail: string, workspaceId: string = 'ws_acme_corp', customerId?: string): Promise<any> {
    return this.fetch('/api/v1/compliance/export', {
      method: 'POST',
      body: JSON.stringify({ customer_email: customerEmail, workspace_id: workspaceId, customer_id: customerId })
    });
  }

  public async eraseCustomerData(customerEmail: string, workspaceId: string = 'ws_acme_corp', reason?: string): Promise<any> {
    return this.fetch('/api/v1/compliance/erase', {
      method: 'POST',
      body: JSON.stringify({ customer_email: customerEmail, workspace_id: workspaceId, reason })
    });
  }
}

export const apiClient = new ShopMateApiClient();
