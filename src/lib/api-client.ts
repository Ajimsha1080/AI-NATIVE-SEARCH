/**
 * Centralized, Typed API Client for ShopMate AaaS
 * Features:
 * - Credentials included ('include') for httpOnly, Secure, SameSite cookies
 * - Central request wrapping
 * - Automatic token refresh on 401 and redirect to /auth/login
 * - CSRF token propagation
 * - Strictly calls standardized /api/<path> endpoints
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

export interface Deployment {
  id: string;
  workspace_id?: string;
  name: string;
  status: string;
  public_key?: string;
  allowed_domains?: string[];
  theme?: Record<string, any>;
  branding?: Record<string, any>;
  embed_code?: string;
}

class ShopMateApiClient {
  private baseUrl: string;
  private isRefreshing: boolean = false;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  public async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    // Propagate CSRF token if cookie is present
    const csrfToken = this.getCookie('csrf_token');
    if (csrfToken && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const requestOptions: RequestInit = {
      ...options,
      credentials: 'include', // Automatically send httpOnly cookies
      headers
    };

    let res = await fetch(`${this.baseUrl}${path}`, requestOptions);

    // If 401 Unauthorized and not already attempting refresh or calling auth endpoints
    if (res.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/refresh')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshRes = await fetch(`${this.baseUrl}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });

          if (refreshRes.ok) {
            this.isRefreshing = false;
            // Retry the original request
            res = await fetch(`${this.baseUrl}${path}`, requestOptions);
          } else {
            this.isRefreshing = false;
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
              window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
            }
          }
        } catch {
          this.isRefreshing = false;
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
            window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          }
        }
      }
    }

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
  public async searchAI(query: string, deploymentKey?: string): Promise<AISearchResponse> {
    const headers: Record<string, string> = {};
    if (deploymentKey) headers['X-Deployment-Key'] = deploymentKey;
    return this.fetch<AISearchResponse>('/api/ai-mode/search', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query })
    });
  }

  public async chatAI(message: string, conversationId?: string, deploymentKey?: string): Promise<AIChatResponse> {
    const headers: Record<string, string> = {};
    if (deploymentKey) headers['X-Deployment-Key'] = deploymentKey;
    return this.fetch<AIChatResponse>('/api/ai-mode/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_message: message, conversation_id: conversationId })
    });
  }

  // --- Knowledge Management ---
  public async getKnowledgeSources(): Promise<{ sources: any[] }> {
    return this.fetch<{ sources: any[] }>('/api/ai-mode/knowledge');
  }

  public async addKnowledgeSource(data: { name: string; type?: string; url?: string; content?: string }): Promise<any> {
    return this.fetch('/api/ai-mode/knowledge', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async syncKnowledgeSource(data: { id?: string; url?: string; name?: string }): Promise<any> {
    return this.fetch('/api/ai-mode/knowledge/sync', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async deleteKnowledgeSource(id: string): Promise<any> {
    return this.fetch(`/api/ai-mode/knowledge/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Deployments ---
  public async getDeployments(): Promise<{ deployments: Deployment[] }> {
    return this.fetch<{ deployments: Deployment[] }>('/api/ai-mode/deployments');
  }

  public async createDeployment(data: { name: string; allowed_domains?: string[]; theme?: any; branding?: any }): Promise<any> {
    return this.fetch('/api/ai-mode/deployments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- AI Mode Config ---
  public async getAIModeConfig(): Promise<any> {
    return this.fetch('/api/ai-mode/config');
  }

  public async updateAIModeConfig(config: any): Promise<any> {
    return this.fetch('/api/ai-mode/config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  // --- Authentication ---
  public async getAuthMe(): Promise<AuthMeResponse> {
    return this.fetch<AuthMeResponse>('/api/auth/me');
  }

  public async login(email: string, password?: string, workspaceId?: string): Promise<any> {
    return this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, workspace_id: workspaceId })
    });
  }

  public async signup(data: { name: string; email: string; password?: string; workspace_name?: string }): Promise<any> {
    return this.fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async logout(): Promise<any> {
    return this.fetch('/api/auth/logout', { method: 'POST' });
  }

  // --- DPDP Act Compliance & Auditing ---
  public async getAuditLogs(limit: number = 50): Promise<any> {
    return this.fetch(`/api/compliance/audit-logs?limit=${limit}`);
  }

  public async exportCustomerData(customerEmail: string, customerId?: string): Promise<any> {
    return this.fetch('/api/compliance/export', {
      method: 'POST',
      body: JSON.stringify({ customer_email: customerEmail, customer_id: customerId })
    });
  }

  public async eraseCustomerData(customerEmail: string, reason?: string): Promise<any> {
    return this.fetch('/api/compliance/erase', {
      method: 'POST',
      body: JSON.stringify({ customer_email: customerEmail, reason })
    });
  }
}

export const apiClient = new ShopMateApiClient();
