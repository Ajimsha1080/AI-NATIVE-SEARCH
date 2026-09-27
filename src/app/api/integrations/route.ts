import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { WorkspaceIntegration } from '@/types';

export const dynamic = 'force-dynamic';

const INTEGRATION_DEFINITIONS = [
  {
    id: 'shopify',
    name: 'Shopify Storefront & Admin API',
    category: 'STORE',
    type: 'SHOPIFY CONNECTOR',
    description: 'Bi-directional sync for live products, inventory variants, discount coupons, and direct checkout redirect links.',
    authType: 'OAUTH_OR_TOKEN',
    fields: [
      { key: 'storeDomain', label: 'Shopify Store Domain', placeholder: 'your-store.myshopify.com' },
      { key: 'adminToken', label: 'Admin API Access Token', placeholder: 'shpat_xxxxxxxxxxxxxxxx', isSecret: true },
      { key: 'storefrontToken', label: 'Storefront Access Token', placeholder: 'shpst_xxxxxxxxxxxxxxxx', isSecret: true }
    ]
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce REST API',
    category: 'STORE',
    type: 'WOOCOMMERCE REST',
    description: 'Sync WordPress & WooCommerce products, variable sizes, coupon promotional rules, and live order statuses.',
    authType: 'API_KEYS',
    fields: [
      { key: 'restEndpoint', label: 'WooCommerce REST Endpoint', placeholder: 'https://store.example.com/wp-json/wc/v3' },
      { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_xxxxxxxxxxxxxxxx' },
      { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_xxxxxxxxxxxxxxxx', isSecret: true }
    ]
  },
  {
    id: 'razorpay',
    name: 'Razorpay Payment Gateway & Webhooks',
    category: 'PAYMENT',
    type: 'PAYMENT GATEWAY',
    description: 'Instant capture verification for UPI (GPay/PhonePe), Indian Cards, NetBanking, and automated refund authorization.',
    authType: 'API_KEYS',
    fields: [
      { key: 'keyId', label: 'Razorpay Key ID', placeholder: 'rzp_live_xxxxxxxx' },
      { key: 'keySecret', label: 'Razorpay Key Secret', placeholder: 'rzp_secret_xxxxxxxx', isSecret: true }
    ]
  },
  {
    id: 'stripe',
    name: 'Stripe Agentic Checkout & Billing',
    category: 'PAYMENT',
    type: 'PAYMENT GATEWAY',
    description: 'Global credit/debit card processing, 3D Secure verification, subscription billing, and webhooks.',
    authType: 'API_KEYS',
    fields: [
      { key: 'publishableKey', label: 'Stripe Publishable Key', placeholder: 'pk_live_xxxxxxxx' },
      { key: 'secretKey', label: 'Stripe Secret Key', placeholder: 'sk_live_xxxxxxxx', isSecret: true }
    ]
  },
  {
    id: 'logistics',
    name: 'Bluedart & Delhivery Logistics Carrier Sync',
    category: 'LOGISTICS',
    type: 'CARRIER TRACKING',
    description: 'Live AWB courier dispatching and real-time shipment delivery tracking for Indian and international parcels.',
    authType: 'API_KEYS',
    fields: [
      { key: 'carrierAccount', label: 'Logistics Master Account', placeholder: 'CARRIER-ACCOUNT-ID' },
      { key: 'bluedartLicense', label: 'Bluedart License Key', placeholder: 'bd_lic_xxxxxxxx', isSecret: true },
      { key: 'delhiveryApiKey', label: 'Delhivery Surface API Key', placeholder: 'del_api_xxxxxxxx', isSecret: true }
    ]
  },
  {
    id: 'web_crawler',
    name: 'Website Web Crawler & RAG Knowledge Sync',
    category: 'CRAWLER',
    type: 'AI VECTOR SYNC',
    description: 'Crawls e-commerce store subpages (Shipping, Returns, About, FAQs, Policies) into 128-dim dense RAG vectors.',
    authType: 'URL',
    fields: [
      { key: 'targetUrl', label: 'Website Base URL', placeholder: 'https://yourstore.com' },
      { key: 'crawlDepth', label: 'Crawl Depth', placeholder: 'All policy pages & collection routes' }
    ]
  },
  {
    id: 'custom_webhooks',
    name: 'Outbound Commerce Webhooks',
    category: 'WEBHOOK',
    type: 'HMAC-SHA256 SIGNED',
    description: 'Dispatches cryptographically signed events on order lookup, return creation, cart updates, and human agent handoffs.',
    authType: 'WEBHOOK',
    fields: [
      { key: 'deliveryEndpoint', label: 'Webhook Listener URL', placeholder: 'https://api.yourstore.com/webhooks' },
      { key: 'signingSecret', label: 'HMAC Signing Secret', placeholder: 'whsec_xxxxxxxxxxxxxxxx', isSecret: true }
    ]
  }
];

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const storedIntegrations = db.workspace_integrations.filter(
    (wi: WorkspaceIntegration) => wi.workspace_id === session.workspaceId
  );

  const workspaceAuditLogs = db.audit_logs.filter(
    (a: any) => a.workspace_id === session.workspaceId && 
    (a.action === 'INTEGRATION_CONNECTED' || a.action === 'INTEGRATION_DISCONNECTED' || a.action === 'CONNECTOR_SYNC')
  );

  // Build the list of connectors for this workspace
  const connectors = INTEGRATION_DEFINITIONS.map(def => {
    const existing = storedIntegrations.find((wi: WorkspaceIntegration) => wi.integration_id === def.id);
    
    // Find the latest audit trail for this connector
    const latestAudit = workspaceAuditLogs.find(
      a => (a.resource_id === def.id || a.metadata?.integrationId === def.id) &&
           (a.action === 'INTEGRATION_CONNECTED' || a.action === 'INTEGRATION_DISCONNECTED')
    );

    let auditTrail: string | null = null;
    if (latestAudit) {
      const actor = latestAudit.actor_email || 'Admin';
      const actionText = latestAudit.action === 'INTEGRATION_CONNECTED' ? 'Connected' : 'Disconnected';
      const dateStr = new Date(latestAudit.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      auditTrail = `${actionText} by ${actor} on ${dateStr}`;
    }

    if (!existing) {
      // Default new workspace state: strictly NOT_CONNECTED with empty/masked configuration
      return {
        ...def,
        status: 'NOT_CONNECTED' as const,
        connected_at: null,
        connected_by_email: null,
        last_sync_at: null,
        last_sync_status: null,
        last_error: null,
        config: {},
        masked_credentials: {},
        auditTrail
      };
    }

    return {
      ...def,
      status: existing.status,
      connected_at: existing.connected_at || null,
      connected_by_email: existing.connected_by_email || null,
      last_sync_at: existing.last_sync_at || null,
      last_sync_status: existing.last_sync_status || null,
      last_error: existing.last_error || null,
      scopes_granted: existing.scopes_granted || [],
      config: existing.config || {},
      masked_credentials: existing.masked_credentials || {},
      auditTrail: auditTrail || (existing.connected_by_email && existing.connected_at 
        ? `Connected by ${existing.connected_by_email} on ${new Date(existing.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` 
        : null)
    };
  });

  const activeConnectorsCount = connectors.filter(c => c.status === 'CONNECTED').length;
  const productsCount = db.commerce_products.filter(p => p.workspace_id === session.workspaceId).length;
  const ordersCount = db.commerce_orders.filter(o => o.workspace_id === session.workspaceId).length;
  const knowledgeCount = db.knowledge_chunks.filter(c => c.workspace_id === session.workspaceId).length;

  return NextResponse.json({
    connectors,
    metrics: {
      activeConnectors: activeConnectorsCount,
      productsCount,
      ordersCount,
      knowledgeCount,
      webhookHealth: activeConnectorsCount > 0 ? '100% OPERATIONAL' : 'STANDBY'
    }
  });
}
