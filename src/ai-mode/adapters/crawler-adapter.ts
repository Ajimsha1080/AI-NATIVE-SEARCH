import { safeFetch } from '@/lib/utils/safe-fetch';

export interface ExtractedProductInfo {
  title: string;
  description: string;
  price?: number;
  currency?: string;
  images: string[];
  category?: string;
  breadcrumbs?: string[];
  url: string;
  in_stock?: boolean;
  attributes?: Record<string, string>;
}

export interface ExtractedPageKnowledge {
  url: string;
  title: string;
  headings: string[];
  textContent: string;
  products: ExtractedProductInfo[];
  faqItems: { question: string; answer: string }[];
}

export class CrawlerAdapter {
  /**
   * Safely crawls a merchant website URL and extracts structured product & page knowledge.
   */
  public static async crawlUrl(url: string): Promise<ExtractedPageKnowledge> {
    try {
      const response = await safeFetch(url, {
        timeoutMs: 15000,
        maxSizeBytes: 5 * 1024 * 1024,
        headers: {
          'User-Agent': 'ShopMate-AI-Mode-Crawler/2.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Crawler received HTTP ${response.status} from ${url}`);
      }

      const html = await response.text();
      return this.parseHtml(html, url);
    } catch (e: any) {
      console.warn(`[AI Mode Crawler] Failed to crawl ${url}:`, e.message);
      // Return structured fallback rather than crashing
      return {
        url,
        title: url,
        headings: [],
        textContent: '',
        products: [],
        faqItems: []
      };
    }
  }

  /**
   * Parses HTML string into structured page knowledge, Schema.org JSON-LD products, and FAQs.
   */
  public static parseHtml(html: string, sourceUrl: string): ExtractedPageKnowledge {
    const products: ExtractedProductInfo[] = [];
    const faqItems: { question: string; answer: string }[] = [];
    const headings: string[] = [];

    // Extract Title
    let title = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s+/g, ' ').trim();
    }

    // Extract Headings (h1, h2, h3)
    const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(html)) !== null) {
      const cleanH = hMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (cleanH.length > 2 && cleanH.length < 150 && !headings.includes(cleanH)) {
        headings.push(cleanH);
      }
    }

    // Extract JSON-LD Schema.org blocks
    const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonMatch;
    while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const rawJson = jsonMatch[1].trim();
        const data = JSON.parse(rawJson);
        this.extractFromJsonLd(data, sourceUrl, products, faqItems);
      } catch {
        // Skip invalid JSON-LD blocks
      }
    }

    // Clean plain text
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000);

    return {
      url: sourceUrl,
      title: title || sourceUrl,
      headings,
      textContent,
      products,
      faqItems
    };
  }

  private static extractFromJsonLd(
    data: any,
    sourceUrl: string,
    products: ExtractedProductInfo[],
    faqItems: { question: string; answer: string }[]
  ): void {
    if (!data) return;

    if (Array.isArray(data)) {
      data.forEach(item => this.extractFromJsonLd(item, sourceUrl, products, faqItems));
      return;
    }

    if (data['@graph'] && Array.isArray(data['@graph'])) {
      data['@graph'].forEach((item: any) => this.extractFromJsonLd(item, sourceUrl, products, faqItems));
      return;
    }

    const type = data['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
      const offers = data.offers || {};
      const price = parseFloat(offers.price || offers.lowPrice || data.price || '0') || undefined;
      const images: string[] = [];
      if (typeof data.image === 'string') images.push(data.image);
      else if (Array.isArray(data.image)) images.push(...data.image.filter((img: any) => typeof img === 'string'));

      products.push({
        title: data.name || '',
        description: data.description || '',
        price,
        currency: offers.priceCurrency || 'USD',
        images,
        category: data.category || (typeof data.brand === 'string' ? data.brand : data.brand?.name),
        url: data.url || sourceUrl,
        in_stock: offers.availability ? offers.availability.includes('InStock') : true
      });
    } else if (type === 'FAQPage' && Array.isArray(data.mainEntity)) {
      data.mainEntity.forEach((q: any) => {
        if (q['@type'] === 'Question' && q.name && q.acceptedAnswer?.text) {
          faqItems.push({
            question: q.name,
            answer: q.acceptedAnswer.text.replace(/<[^>]+>/g, '')
          });
        }
      });
    }
  }
}
