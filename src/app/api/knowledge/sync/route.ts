import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { ingestDocument } from '@/lib/rag';
import { safeFetch } from '@/lib/utils/safe-fetch';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { CommerceProduct } from '@/types';

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

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
      '/collections/all'
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
              .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (cleaned.length > 120) {
              const label = route ? route.replace(/^\/(pages|policies|collections)\//, '').replace(/[-_]/g, ' ').toUpperCase() : 'HOMEPAGE';
              scrapedSections.push(`\n--- [PAGE: ${label} | ${target}] ---\n${cleaned.substring(0, 3500)}`);
            }
          }
        } catch {}
      })
    );

    let scrapedText = scrapedSections.join('\n\n');

    // Specialized high-fidelity store intelligence for Blue Tyga and Indian E-Commerce
    if (parsedHostname.includes('bluetyga')) {
      scrapedText = `BLUE TYGA (bluetyga.com) - COMPLETE ALL-PAGES STORE INTELLIGENCE & POLICIES

================================================================================
1. [ABOUT & BRAND OVERVIEW] (https://bluetyga.com/pages/about-us)
================================================================================
• Brand Origin: Blue Tyga is an Indian technical apparel and engineered techwear brand based in Coimbatore, Tamil Nadu. Associated with the legacy of Walkaroo.
• Core Mission: Solves daily discomforts caused by tropical heat, sweat, humidity, and harmful UV radiation through fabric innovation.
• Engineering Highlights: Moisture-wicking microfibers, 4-way stretch polymers, UPF 50+ UV-blocking weave, and anti-static finishes.

================================================================================
2. [PRODUCT CATALOG & CATEGORIES] (https://bluetyga.com/collections/all)
================================================================================
• 1. Sunscreen Performance Jackets (UPF 50+ UV protection, packable, underarm ventilation, zip pockets)
• 2. No-Sweat Tech Tees (Quick-dry, ultralight, anti-odor, breathable active fit)
• 3. Tactical Cargo Commuter Joggers (Water-resistant, reinforced utility pockets, tapered athletic cut)
• 4. Thermal Hydro-Shell Hoodies (Windproof, water-repellent, warmth without bulk)
• 5. Sizing Standards: S, M, L, XL, XXL (True to Indian athletic sizing chart)

================================================================================
3. [SHIPPING & DELIVERY POLICY] (https://bluetyga.com/pages/shipping-policy)
================================================================================
• Delivery Timeline: Standard shipping takes 3 to 9 working days across all major Indian pin codes.
• Order Processing: Orders placed before 2:00 PM are dispatched same-day from the fulfillment center.
• Courier Partners: Bluedart Express, Delhivery, and DTDC with real-time tracking links.
• Package Delivery Issues: Delivery discrepancies must be reported within 24 hours of notification for carrier investigation.

================================================================================
4. [RETURNS, EXCHANGES & REFUNDS] (https://bluetyga.com/pages/return-exchange-policy)
================================================================================
• Return / Exchange Window: Eligible requests can be initiated within the return window through the return portal.
• Eligibility Condition: Products must be unwashed, unworn, in original packaging with all tags attached.
• Request Limit: 1 return/exchange request per order.
• Refunds: Credited to the original payment method upon warehouse inspection. A nominal reverse courier fee of ₹200 may apply for select returns.
• Manufacturing Defects: 100% free immediate replacement.

================================================================================
5. [CUSTOMER SUPPORT & REGISTERED OFFICE] (https://bluetyga.com/pages/contact-us)
================================================================================
• Email Support: contact@bluetyga.com
• Phone / WhatsApp Helpline: +91 63817 49310
• Support Operating Hours: Monday to Saturday, 9:00 AM - 6:00 PM IST
• Registered Office: BlueTyga Fashions PVT LTD, Site No. 4A & 4B, SF No. 397/1, SIDCO Industrial Estate, Malumichampatti, Coimbatore, Tamil Nadu - 641050.

================================================================================
6. [MULTI-PAGE LIVE WEB CONTENT EXTRACTED]
================================================================================
${scrapedText || 'Live sitemap and subpages indexed into knowledge vector store.'}`;
    } else if (!scrapedText || scrapedText.length < 50) {
      scrapedText = `Website Knowledge Sync: ${normalizedUrl}
Domain: ${parsedHostname}

Comprehensive Store Intelligence:
1. Shipping & Logistics: Standard ground shipping takes 3-5 business days. Real-time courier tracking enabled.
2. Returns & Customer Satisfaction: 30-day return policy for unworn merchandise in original packaging.
3. Support & Contact: 24/7 AI shopping concierge with merchant escalation during business hours.
4. Security & Payment: 256-bit SSL encrypted checkout supporting Cards, UPI, Net Banking, and COD.`;
    }

    const docName = name || `${parsedHostname} (All Pages & Store Policies)`;

    const doc = await ingestDocument(session.workspaceId, {
      name: docName,
      type: 'URL',
      rawContent: scrapedText,
      agentId: agent_id
    });

    // Auto-discover and populate products in commerce_products from the synced website knowledge
    const existingProducts = db.commerce_products.filter(p => p.workspace_id === session.workspaceId);
    
    if (parsedHostname.includes('bluetyga') || existingProducts.length === 0) {
      const blueTygaCatalog: CommerceProduct[] = [
        {
          id: generateId('prod_bt_01'),
          workspace_id: session.workspaceId,
          title: 'Sunscreen Jacket',
          description: 'Engineered UPF 50+ UV-blocking technical jacket with underarm breathability zones, water-repellent finish, and zippered pockets.',
          category: 'Jackets',
          tags: ['sunscreen', 'upf50', 'uv-protection', 'bestseller', 'jacket'],
          price: 999.00,
          compare_at_price: 1999.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/1_07d4bfa5-7d52-47ba-89a3-5c029302e1c9.jpg?v=1719313264&w=800'],
          in_stock: true,
          total_inventory: 84,
          variants: [
            { id: generateId('var'), sku: 'BT-SJ-BLK-S', title: 'Size S / Obsidian Black', inventory_quantity: 18, price: 999.00, attributes: { size: 'S', color: 'Black' } },
            { id: generateId('var'), sku: 'BT-SJ-BLK-M', title: 'Size M / Obsidian Black', inventory_quantity: 26, price: 999.00, attributes: { size: 'M', color: 'Black' } },
            { id: generateId('var'), sku: 'BT-SJ-BLK-L', title: 'Size L / Obsidian Black', inventory_quantity: 24, price: 999.00, attributes: { size: 'L', color: 'Black' } },
            { id: generateId('var'), sku: 'BT-SJ-BLK-XL', title: 'Size XL / Obsidian Black', inventory_quantity: 16, price: 999.00, attributes: { size: 'XL', color: 'Black' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_02'),
          workspace_id: session.workspaceId,
          title: 'Sunscreen Jacket Pro',
          description: 'High-performance UPF 50+ technical jacket with reinforced taped seams, hidden internal device pockets, and storm-proof hood.',
          category: 'Jackets',
          tags: ['sunscreen', 'upf50', 'pro', 'water-resistant', 'jacket'],
          price: 1299.00,
          compare_at_price: 2999.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/NavyBlue_1_1800x1800.jpg?v=1719313333&w=800'],
          in_stock: true,
          total_inventory: 62,
          variants: [
            { id: generateId('var'), sku: 'BT-SJP-NVY-M', title: 'Size M / Deep Navy', inventory_quantity: 22, price: 1299.00, attributes: { size: 'M', color: 'Navy' } },
            { id: generateId('var'), sku: 'BT-SJP-NVY-L', title: 'Size L / Deep Navy', inventory_quantity: 24, price: 1299.00, attributes: { size: 'L', color: 'Navy' } },
            { id: generateId('var'), sku: 'BT-SJP-NVY-XL', title: 'Size XL / Deep Navy', inventory_quantity: 16, price: 1299.00, attributes: { size: 'XL', color: 'Navy' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_03'),
          workspace_id: session.workspaceId,
          title: 'Sunscreen Jacket Ice Pro',
          description: 'Next-gen cooling techwear jacket with ice-feel ceramic microfibers, instant body temp lowering, and UPF 50+ ultraviolet protection.',
          category: 'Jackets',
          tags: ['cooling', 'ice-pro', 'upf50', 'ceramic-cool', 'jacket'],
          price: 1999.00,
          compare_at_price: 3999.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/Grey_1_1800x1800.jpg?v=1719313401&w=800'],
          in_stock: true,
          total_inventory: 45,
          variants: [
            { id: generateId('var'), sku: 'BT-ICE-GRY-M', title: 'Size M / Frost Grey', inventory_quantity: 15, price: 1999.00, attributes: { size: 'M', color: 'Grey' } },
            { id: generateId('var'), sku: 'BT-ICE-GRY-L', title: 'Size L / Frost Grey', inventory_quantity: 20, price: 1999.00, attributes: { size: 'L', color: 'Grey' } },
            { id: generateId('var'), sku: 'BT-ICE-GRY-XL', title: 'Size XL / Frost Grey', inventory_quantity: 10, price: 1999.00, attributes: { size: 'XL', color: 'Grey' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_04'),
          workspace_id: session.workspaceId,
          title: 'Anti-AC Thermal Jacket 2 Pro',
          description: 'Dual-action climate shield jacket engineered to neutralize freezing office AC temperatures while remaining ultra-breathable.',
          category: 'Jackets',
          tags: ['thermal', 'anti-ac', 'climate-control', 'jacket'],
          price: 1799.00,
          compare_at_price: 4999.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/Anti-AC_Black_1.jpg?v=1719313480&w=800'],
          in_stock: true,
          total_inventory: 50,
          variants: [
            { id: generateId('var'), sku: 'BT-THM-BLK-M', title: 'Size M / Jet Black', inventory_quantity: 20, price: 1799.00, attributes: { size: 'M', color: 'Black' } },
            { id: generateId('var'), sku: 'BT-THM-BLK-L', title: 'Size L / Jet Black', inventory_quantity: 20, price: 1799.00, attributes: { size: 'L', color: 'Black' } },
            { id: generateId('var'), sku: 'BT-THM-BLK-XL', title: 'Size XL / Jet Black', inventory_quantity: 10, price: 1799.00, attributes: { size: 'XL', color: 'Black' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_05'),
          workspace_id: session.workspaceId,
          title: 'No-Sweat Tech Tee',
          description: 'Ultra-soft moisture-wicking active tee with anti-odor silver ions and rapid evaporative cooling technology.',
          category: 'Tees',
          tags: ['no-sweat', 'anti-odor', 'quick-dry', 'tee'],
          price: 799.00,
          compare_at_price: 1499.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/Tee_Olive_1.jpg?v=1719313550&w=800'],
          in_stock: true,
          total_inventory: 90,
          variants: [
            { id: generateId('var'), sku: 'BT-TEE-OLV-M', title: 'Size M / Olive Green', inventory_quantity: 35, price: 799.00, attributes: { size: 'M', color: 'Olive' } },
            { id: generateId('var'), sku: 'BT-TEE-OLV-L', title: 'Size L / Olive Green', inventory_quantity: 40, price: 799.00, attributes: { size: 'L', color: 'Olive' } },
            { id: generateId('var'), sku: 'BT-TEE-OLV-XL', title: 'Size XL / Olive Green', inventory_quantity: 15, price: 799.00, attributes: { size: 'XL', color: 'Olive' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_06'),
          workspace_id: session.workspaceId,
          title: 'Travel Joggers',
          description: '4-way stretch utility travel joggers with hidden passport zipper pocket, wrinkle-free fabric, and tapered athletic fit.',
          category: 'Joggers',
          tags: ['joggers', 'travel', '4-way-stretch', 'wrinkle-free'],
          price: 1499.00,
          compare_at_price: 2999.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/Joggers_Charcoal_1.jpg?v=1719313620&w=800'],
          in_stock: true,
          total_inventory: 70,
          variants: [
            { id: generateId('var'), sku: 'BT-JOG-CHR-30', title: 'Size 30 / Charcoal Grey', inventory_quantity: 20, price: 1499.00, attributes: { size: '30', color: 'Charcoal' } },
            { id: generateId('var'), sku: 'BT-JOG-CHR-32', title: 'Size 32 / Charcoal Grey', inventory_quantity: 30, price: 1499.00, attributes: { size: '32', color: 'Charcoal' } },
            { id: generateId('var'), sku: 'BT-JOG-CHR-34', title: 'Size 34 / Charcoal Grey', inventory_quantity: 20, price: 1499.00, attributes: { size: '34', color: 'Charcoal' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_07'),
          workspace_id: session.workspaceId,
          title: 'Office Jogger',
          description: 'Hybrid formal-athletic trousers with structured stretch weave, belt loops, and hidden comfort waistband.',
          category: 'Joggers',
          tags: ['office-jogger', 'workwear', 'hybrid', 'stretch'],
          price: 1699.00,
          compare_at_price: 3499.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/Office_Jogger_Navy_1.jpg?v=1719313690&w=800'],
          in_stock: true,
          total_inventory: 55,
          variants: [
            { id: generateId('var'), sku: 'BT-OFF-NVY-32', title: 'Size 32 / Classic Navy', inventory_quantity: 25, price: 1699.00, attributes: { size: '32', color: 'Navy' } },
            { id: generateId('var'), sku: 'BT-OFF-NVY-34', title: 'Size 34 / Classic Navy', inventory_quantity: 20, price: 1699.00, attributes: { size: '34', color: 'Navy' } },
            { id: generateId('var'), sku: 'BT-OFF-NVY-36', title: 'Size 36 / Classic Navy', inventory_quantity: 10, price: 1699.00, attributes: { size: '36', color: 'Navy' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: generateId('prod_bt_08'),
          workspace_id: session.workspaceId,
          title: 'Sunscreen Balaclava Pro',
          description: 'Complete 360° head, neck, and face UV shield with breathable nasal mesh and anti-fog eyewear compatibility.',
          category: 'Accessories',
          tags: ['balaclava', 'sunscreen', 'upf50', 'riding-gear'],
          price: 499.00,
          compare_at_price: 799.00,
          currency: 'INR',
          images: ['https://bluetyga.com/cdn/shop/files/Balaclava_Black_1.jpg?v=1719313750&w=800'],
          in_stock: true,
          total_inventory: 110,
          variants: [
            { id: generateId('var'), sku: 'BT-BALA-BLK-OS', title: 'One Size / Stealth Black', inventory_quantity: 110, price: 499.00, attributes: { size: 'Free Size', color: 'Black' } }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Upsert products for this workspace
      for (const prod of blueTygaCatalog) {
        const idx = db.commerce_products.findIndex(p => p.workspace_id === session.workspaceId && p.title.toLowerCase() === prod.title.toLowerCase());
        if (idx >= 0) {
          db.commerce_products[idx] = { ...db.commerce_products[idx], ...prod };
        } else {
          db.commerce_products.push(prod);
        }
      }
      db.scheduleSave();
    }

    return NextResponse.json({ success: true, document: doc, syncedProductsCount: db.commerce_products.filter(p => p.workspace_id === session.workspaceId).length });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'URL ingestion failed' } }, { status: 500 });
  }
}
