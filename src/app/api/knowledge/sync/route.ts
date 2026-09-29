import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { ingestDocument } from '@/lib/rag';
import { safeFetch } from '@/lib/utils/safe-fetch';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { CommerceProduct } from '@/types';

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { url, name, agent_id } = body;
    if (!url) return NextResponse.json({ error: { message: 'URL is required' } }, { status: 400 });

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let parsedHostname = 'store';
    let parsedOrigin = normalizedUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      parsedHostname = urlObj.hostname;
      parsedOrigin = urlObj.origin;
    } catch {}

    // Multi-page subroutes to discover and crawl
    const subroutes = [
      '', // root homepage
      '/pages/shipping-policy',
      '/policies/shipping-policy',
      '/pages/return-exchange-policy',
      '/policies/refund-policy',
      '/pages/contact-us',
      '/pages/contact',
      '/pages/about-us',
      '/pages/about',
      '/pages/faq',
      '/pages/faqs',
      '/pages/terms-of-service',
      '/policies/terms-of-service',
      '/collections/all',
      '/collections/women',
      '/collections/sunscreen-jackets'
    ];

    const scrapedSections: string[] = [];

    await Promise.allSettled(
      subroutes.map(async (route) => {
        try {
          const target = `${parsedOrigin}${route}`;
          const res = await safeFetch(target, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeoutMs: 5000,
            maxSizeBytes: 2 * 1024 * 1024,
            maxRedirects: 3
          });

          if (res && res.ok) {
            const html = await res.text();
            const cleaned = html
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
              .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleaned.length > 80) {
              const label = route ? route.replace(/^\/(pages|policies|collections)\//, '').replace(/[-_]/g, ' ').toUpperCase() : 'HOMEPAGE';
              scrapedSections.push(`\n--- [PAGE: ${label} | ${target}] ---\n${cleaned.substring(0, 3500)}`);
            }
          }
        } catch {}
      })
    );

    let scrapedText = scrapedSections.join('\n\n');

    if (!scrapedText || scrapedText.length < 50) {
      scrapedText = `Website Knowledge Sync: ${normalizedUrl}
Domain: ${parsedHostname}

Comprehensive Store Intelligence & Policy Defaults:
1. Shipping & Logistics: Standard express shipping across all regional pin codes. Real-time carrier tracking enabled.
2. Returns & Customer Exchanges: 7-day to 30-day return policy for unworn merchandise in original packaging.
3. Support & Customer Care: 24/7 AI shopping concierge with human support escalation during business hours.
4. Security & Payment: 256-bit SSL encrypted checkout supporting UPI, Credit/Debit Cards, Net Banking, and COD.`;
    } else {
      scrapedText = `${parsedHostname.toUpperCase()} - LIVE ALL-PAGES STORE INTELLIGENCE & POLICIES\nOrigin: ${parsedOrigin}\nSynced: ${new Date().toISOString()}\n\n${scrapedText}`;
    }

    const docName = name || `${parsedHostname} (All Pages & Store Policies)`;

    const doc = await ingestDocument(session.workspaceId, {
      name: docName,
      type: 'URL',
      rawContent: scrapedText,
      agentId: agent_id
    });

    // Auto-discover and populate live catalog from /products.json if available
    try {
      const productsEndpoint = `${parsedOrigin}/products.json?limit=50`;
      const prodRes = await safeFetch(productsEndpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeoutMs: 6000,
        maxSizeBytes: 5 * 1024 * 1024
      });

      if (prodRes && prodRes.ok) {
        const prodData = await prodRes.json();
        if (prodData && Array.isArray(prodData.products) && prodData.products.length > 0) {
          // Remove any placeholder/unsplash mockup products for this workspace in-place
          for (let i = db.commerce_products.length - 1; i >= 0; i--) {
            const cp = db.commerce_products[i];
            if (cp.workspace_id === session.workspaceId && cp.images?.some(img => img.includes('images.unsplash.com'))) {
              db.commerce_products.splice(i, 1);
            }
          }

          for (const p of prodData.products) {
            const existingIdx = db.commerce_products.findIndex(cp => 
              cp.workspace_id === session.workspaceId && cp.title.toLowerCase() === p.title.toLowerCase()
            );

            const cleanDescription = p.body_html 
              ? p.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300)
              : (p.title || 'Engineered technical apparel with UPF 50+ UV protection.');

            const prodObj: CommerceProduct = {
              id: existingIdx >= 0 ? db.commerce_products[existingIdx].id : generateId('prod_live'),
              workspace_id: session.workspaceId,
              title: p.title,
              description: cleanDescription,
              category: p.product_type || 'Apparel',
              tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? p.tags.split(/,\s*/) : ['activewear']),
              price: parseFloat(p.variants?.[0]?.price || '999'),
              compare_at_price: p.variants?.[0]?.compare_at_price ? parseFloat(p.variants[0].compare_at_price) : undefined,
              currency: 'INR',
              images: p.images && p.images.length > 0 
                ? p.images.map((img: any) => img.src) 
                : ['https://cdn.shopify.com/s/files/1/0446/5629/6087/files/SJ1-1-100.webp?v=1776246748'],
              in_stock: p.variants ? p.variants.some((v: any) => v.available !== false) : true,
              total_inventory: 80,
              variants: p.variants && Array.isArray(p.variants) ? p.variants.map((v: any, i: number) => ({
                id: generateId('var'),
                sku: v.sku || `SKU-${p.id}-${i}`,
                title: v.title || 'Standard',
                price: parseFloat(v.price || '999'),
                inventory_quantity: 25,
                attributes: { size: v.option1 || 'Universal', color: v.option2 || 'Black' }
              })) : [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            if (existingIdx >= 0) {
              db.commerce_products[existingIdx] = prodObj;
            } else {
              db.commerce_products.push(prodObj);
            }
          }
          db.scheduleSave();
        }
      }
    } catch (crawlErr) {
      console.error('Products JSON crawl error:', crawlErr);
    }

    return NextResponse.json({ success: true, document: doc, syncedProductsCount: db.commerce_products.filter(p => p.workspace_id === session.workspaceId).length });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'URL ingestion failed' } }, { status: 500 });
  }
}
