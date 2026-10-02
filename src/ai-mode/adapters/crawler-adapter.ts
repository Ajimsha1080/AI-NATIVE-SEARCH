import { safeFetch } from '@/lib/utils/safe-fetch';

export interface CrawledProduct {
  id?: string;
  title: string;
  price: number;
  sale_price?: number;
  description: string;
  category?: string;
  tags?: string[];
  images: string[];
  url: string;
  in_stock?: boolean;
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    in_stock: boolean;
    attributes?: Record<string, string>;
  }>;
}

export interface CrawlResult {
  url: string;
  title: string;
  textContent: string;
  extractedProducts: CrawledProduct[];
  policyChunks: string[];
  pagesCrawledCount: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export class AIModeCrawlerAdapter {
  private static USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ShopMate-AIMode/2.0';

  /**
   * Deep multi-page crawler that crawls the homepage, sitemaps, collection pages,
   * product endpoints (/products.json), and policy subpages across the whole website.
   */
  public static async crawlWebsite(url: string): Promise<CrawlResult> {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
      }

      const origin = parsedUrl.origin;
      const allExtractedProducts = new Map<string, CrawledProduct>();
      const allPolicyChunks: string[] = [];
      const visitedUrls = new Set<string>();
      let aggregatedTextContent = '';
      let siteTitle = parsedUrl.hostname;

      // -------------------------------------------------------------
      // 1. Fetch Root Homepage
      // -------------------------------------------------------------
      try {
        const homeRes = await safeFetch(url, {
          headers: { 'User-Agent': this.USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
          timeoutMs: 12000,
          maxSizeBytes: 5 * 1024 * 1024
        });

        if (homeRes.ok) {
          visitedUrls.add(url);
          const homeHtml = await homeRes.text();
          const titleMatch = homeHtml.match(/<title[^>]*>(.*?)<\/title>/i);
          if (titleMatch) siteTitle = titleMatch[1].trim();

          // Extract products and policies from homepage
          this.extractProductsFromHtml(homeHtml, url).forEach(p => allExtractedProducts.set(p.title.toLowerCase().trim(), p));
          const homeChunks = this.extractTextAndChunks(homeHtml);
          allPolicyChunks.push(...homeChunks.chunks);
          aggregatedTextContent += homeChunks.cleanText + ' ';

          // Discover subpage links from homepage
          const discoveredLinks = this.discoverSubLinks(homeHtml, origin);
          
          // -------------------------------------------------------------
          // 2. Fetch Policy & Information Subpages (e.g. shipping, returns, about, faq)
          // -------------------------------------------------------------
          const policyUrls = discoveredLinks.filter(link => 
            /\/(pages\/(?:shipping|returns?|refund|policy|about|faq|contact|terms|exchange)|shipping|returns?|policies|faq|about-us|contact)/i.test(link)
          ).slice(0, 8);

          await Promise.allSettled(policyUrls.map(async (policyUrl) => {
            if (visitedUrls.has(policyUrl)) return;
            visitedUrls.add(policyUrl);
            try {
              const res = await safeFetch(policyUrl, { headers: { 'User-Agent': this.USER_AGENT }, timeoutMs: 8000, maxSizeBytes: 3 * 1024 * 1024 });
              if (res.ok) {
                const subHtml = await res.text();
                const extracted = this.extractTextAndChunks(subHtml);
                allPolicyChunks.push(...extracted.chunks);
                aggregatedTextContent += extracted.cleanText + ' ';
              }
            } catch (e) {
              // Ignore individual subpage error
            }
          }));
        }
      } catch (e: any) {
        console.warn('AI Mode crawler root fetch warning:', e.message);
      }

      // -------------------------------------------------------------
      // 3. Deep Product Ingestion via Catalog Endpoints (/products.json & sitemaps)
      // -------------------------------------------------------------
      try {
        let page = 1;
        let hasMorePages = true;

        while (hasMorePages && page <= 5) {
          const endpointUrl = `${origin}/products.json?limit=250&page=${page}`;
          const prodRes = await safeFetch(endpointUrl, {
            headers: { 'User-Agent': this.USER_AGENT, 'Accept': 'application/json' },
            timeoutMs: 12000,
            maxSizeBytes: 8 * 1024 * 1024
          });

          if (prodRes.ok) {
            const data = await prodRes.json().catch(() => null);
            if (data?.products && Array.isArray(data.products) && data.products.length > 0) {
              for (const p of data.products) {
                const variants = (p.variants || []).map((v: any) => ({
                  id: String(v.id || generateSlug(p.title) + '-' + (v.title || 'var')),
                  title: v.title || 'Default Title',
                  price: parseFloat(v.price || '0') || 0,
                  in_stock: (v.available ?? true) && (v.inventory_quantity ?? 1) > 0,
                  attributes: {
                    ...(v.option1 ? { option1: v.option1 } : {}),
                    ...(v.option2 ? { option2: v.option2 } : {}),
                    ...(v.option3 ? { option3: v.option3 } : {})
                  }
                }));

                const firstVariantPrice = variants[0]?.price || parseFloat(p.variants?.[0]?.price || '0') || 0;
                const comparePrice = parseFloat(p.variants?.[0]?.compare_at_price || '0') || undefined;
                const images = (p.images || []).map((img: any) => typeof img === 'string' ? img : img.src).filter(Boolean);

                const productItem: CrawledProduct = {
                  id: `prod_crawl_${p.id || generateSlug(p.title)}`,
                  title: p.title,
                  price: firstVariantPrice,
                  sale_price: comparePrice,
                  description: cleanHtmlText(p.body_html || ''),
                  category: p.product_type || inferCategory(p.title, p.tags),
                  tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? p.tags.split(',').map((t: string) => t.trim()) : []),
                  images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400'],
                  url: `${origin}/products/${p.handle || p.id}`,
                  in_stock: variants.some((v: any) => v.in_stock),
                  variants
                };

                allExtractedProducts.set(productItem.title.toLowerCase().trim(), productItem);
              }

              if (data.products.length < 250) {
                hasMorePages = false;
              } else {
                page++;
              }
            } else {
              hasMorePages = false;
            }
          } else {
            hasMorePages = false;
          }
        }
      } catch (e: any) {
        console.warn('AI Mode crawler products.json attempt notice:', e.message);
      }

      // -------------------------------------------------------------
      // 4. Sitemap Discovery Fallback if products.json was empty
      // -------------------------------------------------------------
      if (allExtractedProducts.size < 10) {
        try {
          const sitemapUrl = `${origin}/sitemap_products_1.xml`;
          const sitemapRes = await safeFetch(sitemapUrl, {
            headers: { 'User-Agent': this.USER_AGENT },
            timeoutMs: 8000,
            maxSizeBytes: 5 * 1024 * 1024
          });

          if (sitemapRes.ok) {
            const sitemapXml = await sitemapRes.text();
            const locMatches = sitemapXml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/gi) || [];
            const productUrls = locMatches.map(m => m.replace(/<\/?loc>/gi, '').trim()).slice(0, 20);

            await Promise.allSettled(productUrls.map(async (prodUrl) => {
              if (visitedUrls.has(prodUrl)) return;
              visitedUrls.add(prodUrl);
              try {
                const res = await safeFetch(prodUrl, { headers: { 'User-Agent': this.USER_AGENT }, timeoutMs: 6000 });
                if (res.ok) {
                  const html = await res.text();
                  this.extractProductsFromHtml(html, prodUrl).forEach(p => allExtractedProducts.set(p.title.toLowerCase().trim(), p));
                }
              } catch (e) {}
            }));
          }
        } catch (e) {}
      }

      const productsArray = Array.from(allExtractedProducts.values());

      return {
        url,
        title: siteTitle,
        textContent: aggregatedTextContent.trim(),
        extractedProducts: productsArray,
        policyChunks: allPolicyChunks,
        pagesCrawledCount: visitedUrls.size || 1,
        status: 'SUCCESS'
      };
    } catch (err: any) {
      return {
        url,
        title: url,
        textContent: '',
        extractedProducts: [],
        policyChunks: [],
        pagesCrawledCount: 0,
        status: 'FAILED',
        errorMessage: err.message || 'Crawl failed'
      };
    }
  }

  /**
   * Helper: Extracts JSON-LD schema & OpenGraph product metadata from raw HTML
   */
  private static extractProductsFromHtml(html: string, pageUrl: string): CrawledProduct[] {
    const products: CrawledProduct[] = [];

    // 1. JSON-LD Schema.org
    const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let ldMatch;
    while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(ldMatch[1].trim());
        const entities = Array.isArray(json) ? json : (json['@graph'] || [json]);
        for (const item of entities) {
          if (item['@type'] === 'Product' || (item.name && item.offers)) {
            const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            const price = parseFloat(offers?.price || '0') || 0;
            const images = Array.isArray(item.image) ? item.image : (item.image ? [item.image] : []);

            products.push({
              id: `prod_${generateSlug(item.name || 'product')}`,
              title: item.name || 'Discovered Product',
              price,
              description: cleanHtmlText(item.description || ''),
              category: item.category || inferCategory(item.name || '', []),
              images: images.length > 0 ? images : [],
              url: item.url || pageUrl,
              in_stock: offers?.availability?.includes('InStock') ?? true
            });
          }
        }
      } catch (e) {}
    }

    return products;
  }

  /**
   * Helper: Discovers valid internal links
   */
  private static discoverSubLinks(html: string, origin: string): string[] {
    const links = new Set<string>();
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      const rawHref = match[1].trim();
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
        continue;
      }
      try {
        const resolved = new URL(rawHref, origin);
        if (resolved.origin === origin) {
          links.add(resolved.href);
        }
      } catch (e) {}
    }
    return Array.from(links);
  }

  /**
   * Helper: Cleans HTML and extracts readable policy sentences
   */
  private static extractTextAndChunks(html: string): { cleanText: string; chunks: string[] } {
    const cleanText = cleanHtmlText(html);
    const chunks: string[] = [];
    const sentences = cleanText.split(/(?<=[.?!])\s+/);
    let currentChunk = '';
    for (const s of sentences) {
      if ((currentChunk + ' ' + s).length > 400) {
        if (currentChunk.trim().length > 50) chunks.push(currentChunk.trim());
        currentChunk = s;
      } else {
        currentChunk += ' ' + s;
      }
    }
    if (currentChunk.trim().length > 50) {
      chunks.push(currentChunk.trim());
    }
    return { cleanText, chunks };
  }
}

function cleanHtmlText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 30);
}

function inferCategory(title: string, tags: string[] = []): string {
  const combined = `${title} ${tags.join(' ')}`.toLowerCase();
  if (combined.includes('shirt')) return 'Shirt';
  if (combined.includes('pant') || combined.includes('trouser') || combined.includes('jean')) return 'Pants';
  if (combined.includes('jacket') || combined.includes('hoodie')) return 'Outerwear';
  if (combined.includes('tee') || combined.includes('t-shirt')) return 'T-Shirt';
  if (combined.includes('dress') || combined.includes('saree')) return 'Women Wear';
  return 'Apparel';
}
