// In-memory client-side cache for instantaneous (0ms) page transitions
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export async function fetchWithCache<T = any>(
  url: string,
  options?: RequestInit,
  ttlMs: number = 60000
): Promise<T | null> {
  const cached = memoryCache.get(url);
  const now = Date.now();

  // If cached and fresh, return immediately
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // Fetch from network
  try {
    const headers = new Headers(options?.headers || {});
    const res = await fetch(url, { ...options, headers, credentials: options?.credentials || 'include' });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Gracefully handle unauthenticated/guest session queries without throwing fatal client errors
        return null;
      }
      throw new Error(`Fetch error: ${res.statusText}`);
    }
    const data = await res.json();
    memoryCache.set(url, { data, timestamp: now });
    return data as T;
  } catch (err) {
    // If network fails or times out, fallback to cached data if available
    if (cached) {
      return cached.data as T;
    }
    return null;
  }
}

export function getClientCachedData<T = any>(url: string): T | null {
  const cached = memoryCache.get(url);
  return cached ? (cached.data as T) : null;
}

export function setClientCachedData(url: string, data: any): void {
  memoryCache.set(url, { data, timestamp: Date.now() });
}

export function invalidateClientCache(urlPattern?: string): void {
  if (!urlPattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(urlPattern)) {
      memoryCache.delete(key);
    }
  }
}
