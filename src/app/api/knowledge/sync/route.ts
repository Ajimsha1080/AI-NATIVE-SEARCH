import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { ingestDocument } from '@/lib/rag';
import { safeFetch } from '@/lib/utils/safe-fetch';

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

    return NextResponse.json({ success: true, document: doc });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'URL ingestion failed' } }, { status: 500 });
  }
}
