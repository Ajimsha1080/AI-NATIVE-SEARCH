import { safeFetch } from '@/lib/utils/safe-fetch';

export interface CrawlResult {
  url: string;
  title: string;
  textContent: string;
  extractedProducts: Array<{
    title: string;
    price: number;
    description: string;
    images: string[];
    url: string;
  }>;
  policyChunks: string[];
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export class AIModeCrawlerAdapter {
  public static async crawlWebsite(url: string): Promise<CrawlResult> {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
      }

      const res = await safeFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ShopMate-AIMode/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7'
        },
        timeoutMs: 12000,
        maxSizeBytes: 5 * 1024 * 1024
      });

      if (!res.ok) {
        throw new Error(`Target website returned HTTP status ${res.status}`);
      }

      const html = await res.text();
      const extractedProducts: Array<{
        title: string;
        price: number;
        description: string;
        images: string[];
        url: string;
      }> = [];

      // Extract JSON-LD Schema.org product data if present
      const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let ldMatch;
      while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const json = JSON.parse(ldMatch[1].trim());
          const entities = Array.isArray(json) ? json : (json['@graph'] || [json]);
          for (const item of entities) {
            if (item['@type'] === 'Product' || item.name) {
              const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              const price = parseFloat(offers?.price || '0') || 0;
              extractedProducts.push({
                title: item.name || 'Discovered Product',
                price,
                description: item.description || '',
                images: Array.isArray(item.image) ? item.image : (item.image ? [item.image] : []),
                url: item.url || url
              });
            }
          }
        } catch (e) {
          // Ignore invalid JSON-LD chunks
        }
      }

      // Clean text body
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

      // Extract policy chunks
      const policyChunks: string[] = [];
      const sentences = cleanText.split(/(?<=[.?!])\s+/);
      let currentChunk = '';
      for (const s of sentences) {
        if ((currentChunk + ' ' + s).length > 400) {
          if (currentChunk.length > 50) policyChunks.push(currentChunk.trim());
          currentChunk = s;
        } else {
          currentChunk += ' ' + s;
        }
      }
      if (currentChunk.trim().length > 50) {
        policyChunks.push(currentChunk.trim());
      }

      return {
        url,
        title,
        textContent: cleanText.substring(0, 10000),
        extractedProducts,
        policyChunks: policyChunks.slice(0, 20),
        status: 'SUCCESS'
      };
    } catch (err: any) {
      return {
        url,
        title: url,
        textContent: '',
        extractedProducts: [],
        policyChunks: [],
        status: 'FAILED',
        errorMessage: err.message || 'Crawl failed'
      };
    }
  }
}
