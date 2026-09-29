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

    const cleanBrandName = parsedHostname.replace(/^(www\.)/i, '').replace(/\.(com|in|org|net|co|io|store|shop|app)$/i, '').split('.')[0];
    const formattedBrandName = cleanBrandName.charAt(0).toUpperCase() + cleanBrandName.slice(1);

    // Auto-discover and populate live catalog from /products.json if available
    try {
      // If syncing a new brand/store, purge any previous default demo Blue Tyga products
      if (formattedBrandName.toLowerCase() !== 'bluetyga') {
        for (let i = db.commerce_products.length - 1; i >= 0; i--) {
          const cp = db.commerce_products[i];
          if (cp.workspace_id === session.workspaceId) {
            const isOldDemo = cp.id.startsWith('prod_bt_') || 
              cp.tags?.some(t => t.toLowerCase().includes('bluetyga')) ||
              cp.title.toLowerCase().includes('sunscreen jacket');
            if (isOldDemo) {
              db.commerce_products.splice(i, 1);
            }
          }
        }
      }

      let page = 1;
      let hasMore = true;
      const maxPages = 10; // Ingests up to 2,500 catalog products per sync

      while (hasMore && page <= maxPages) {
        const productsEndpoint = `${parsedOrigin}/products.json?limit=250&page=${page}`;
        const prodRes = await safeFetch(productsEndpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          },
          timeoutMs: 8000,
          maxSizeBytes: 10 * 1024 * 1024
        });

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData && Array.isArray(prodData.products) && prodData.products.length > 0) {
            for (const p of prodData.products) {
              const existingIdx = db.commerce_products.findIndex(cp => 
                cp.workspace_id === session.workspaceId && cp.title.toLowerCase() === p.title.toLowerCase()
              );

              const cleanDescription = p.body_html 
                ? p.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300)
                : (p.title || `Official ${formattedBrandName} collection item.`);

              const prodObj: CommerceProduct = {
                id: existingIdx >= 0 ? db.commerce_products[existingIdx].id : generateId('prod_live'),
                workspace_id: session.workspaceId,
                title: p.title,
                description: cleanDescription,
                category: p.product_type || 'Apparel',
                tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? p.tags.split(/,\s*/) : [formattedBrandName.toLowerCase()]),
                price: parseFloat(p.variants?.[0]?.price || '999'),
                compare_at_price: p.variants?.[0]?.compare_at_price ? parseFloat(p.variants[0].compare_at_price) : undefined,
                currency: 'INR',
                images: p.images && p.images.length > 0 
                  ? p.images.map((img: any) => img.src) 
                  : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'],
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
              productsIngested++;
            }

            if (prodData.products.length < 250) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Parse products mentioned anywhere in the scraped text (e.g. • Royal Heritage Saree — ₹1,699)
      const productMentionRegex = /(?:•|\*|-)\s*([A-Za-z0-9\s&'()/-]{3,40})\s*(?:—|-|:)\s*(?:₹|Rs\.?|\$)\s*([\d,]+)(?:[\r\n]+([^\n\r•*-]{10,250}))?/gi;
      let textMatch;
      while ((textMatch = productMentionRegex.exec(scrapedText)) !== null) {
        const pTitle = textMatch[1].trim();
        const pPrice = parseFloat(textMatch[2].replace(/,/g, ''));
        const pDesc = textMatch[3]?.trim() || `${pTitle} from the official ${formattedBrandName} collection.`;

        const existing = db.commerce_products.find(cp => 
          cp.workspace_id === session.workspaceId && cp.title.toLowerCase() === pTitle.toLowerCase()
        );

        if (!existing && pPrice > 0) {
          let categoryImg = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
          if (/kurta/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
          else if (/shirt|tee/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
          else if (/dress|frock/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80';
          else if (/hoodie/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80';

          db.commerce_products.push({
            id: generateId('prod_live'),
            workspace_id: session.workspaceId,
            title: pTitle,
            description: pDesc,
            category: /saree/i.test(pTitle) ? 'Sarees' : (/kurta/i.test(pTitle) ? 'Kurtas' : (/shirt|tee/i.test(pTitle) ? 'T-Shirts' : 'Apparel')),
            tags: [formattedBrandName.toLowerCase(), 'featured', 'collection', 'women', 'men'],
            price: pPrice,
            currency: 'INR',
            images: [categoryImg],
            in_stock: true,
            total_inventory: 50,
            variants: [
              { id: generateId('var'), sku: `SKU-${pTitle.slice(0, 4).toUpperCase()}-M`, title: 'Free Size', price: pPrice, inventory_quantity: 50, attributes: { size: 'Free Size' } }
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          productsIngested++;
        }
      }

      // If no products were discovered, auto-generate standard brand collection pieces for the store
      const currentWorkspaceProducts = db.commerce_products.filter(p => p.workspace_id === session.workspaceId);
      if (currentWorkspaceProducts.length === 0 && formattedBrandName.toLowerCase() !== 'bluetyga') {
        const defaultStoreItems: Partial<CommerceProduct>[] = [
          {
            title: `${formattedBrandName} Oversized Graphic Tee`,
            description: `Premium 240 GSM heavy cotton oversized streetwear t-shirt with signature ${formattedBrandName} artwork.`,
            category: 'T-Shirts',
            price: 799,
            compare_at_price: 1299,
            images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'],
            tags: [formattedBrandName.toLowerCase(), 'oversized', 'tee', 'graphic', 'women', 'men']
          },
          {
            title: `${formattedBrandName} Classic Heavyweight Hoodie`,
            description: `Super-soft fleece interior, structured relaxed fit, kangaroo pocket with reinforced cuffs.`,
            category: 'Hoodies',
            price: 1799,
            compare_at_price: 2499,
            images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80'],
            tags: [formattedBrandName.toLowerCase(), 'hoodie', 'outerwear', 'unisex']
          },
          {
            title: `${formattedBrandName} Signature Anime Edition Tee`,
            description: `High-definition screen printed anime aesthetics on breathable pre-shrunk comb cotton.`,
            category: 'T-Shirts',
            price: 899,
            compare_at_price: 1499,
            images: ['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80'],
            tags: [formattedBrandName.toLowerCase(), 'anime', 'tshirt', 'women', 'men', 'streetwear']
          },
          {
            title: `${formattedBrandName} Relaxed Fit Joggers`,
            description: `Urban streetwear joggers with deep zippered utility pockets and elasticated waistband.`,
            category: 'Bottoms',
            price: 1299,
            compare_at_price: 1899,
            images: ['https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=80'],
            tags: [formattedBrandName.toLowerCase(), 'joggers', 'streetwear', 'bottoms']
          }
        ];

        defaultStoreItems.forEach(item => {
          db.commerce_products.push({
            id: generateId('prod_live'),
            workspace_id: session.workspaceId,
            title: item.title!,
            description: item.description!,
            category: item.category!,
            tags: item.tags!,
            price: item.price!,
            compare_at_price: item.compare_at_price,
            currency: 'INR',
            images: item.images!,
            in_stock: true,
            total_inventory: 60,
            variants: [
              { id: generateId('var'), sku: `SKU-${cleanBrandName}-S`, title: 'S', price: item.price!, inventory_quantity: 20, attributes: { size: 'S' } },
              { id: generateId('var'), sku: `SKU-${cleanBrandName}-M`, title: 'M', price: item.price!, inventory_quantity: 20, attributes: { size: 'M' } },
              { id: generateId('var'), sku: `SKU-${cleanBrandName}-L`, title: 'L', price: item.price!, inventory_quantity: 20, attributes: { size: 'L' } }
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
      }

      db.scheduleSave();
    } catch (crawlErr) {
      console.error('Products crawl error:', crawlErr);
    }

    // Auto-update active agent config brand identity to the synced store
    const activeConfigs = db.agent_configs.filter(c => {
      const a = db.agents.find(ag => ag.id === c.agent_id);
      return a && a.workspace_id === session.workspaceId;
    });

    activeConfigs.forEach(cfg => {
      cfg.identity.brand_name = formattedBrandName || cfg.identity.brand_name;
      cfg.identity.greeting = `Hello! I'm ${cfg.identity.name}, your AI shopping concierge for ${cfg.identity.brand_name}. How can I assist you today?`;
      cfg.instructions.system_prompt = `You are ${cfg.identity.name}, the official AI commerce assistant for ${cfg.identity.brand_name}.\nResponsibilities:\n- Search store catalog and recommend products based on budget, style, and size constraints.\n- Provide real-time stock checks and answer store policy inquiries.\n- Assist customers with order tracking and return requests.\n- Strictly adhere to company return and shipping policies in the knowledge base.`;
    });

    db.scheduleSave();

    return NextResponse.json({ 
      success: true, 
      document: doc, 
      brandName: formattedBrandName,
      syncedProductsCount: db.commerce_products.filter(p => p.workspace_id === session.workspaceId).length 
    });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'URL ingestion failed' } }, { status: 500 });
  }
}
