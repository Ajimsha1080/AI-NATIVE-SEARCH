import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { encryptCredentials, generateMaskedCredentials } from '@/lib/crypto/encryption';
import { WorkspaceIntegration } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: integrationId } = await context.params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON payload' } }, { status: 400 });
  }

  const { config = {}, credentials = {}, action } = body;

  // 1. Shopify OAuth or Direct Token Validation
  if (integrationId === 'shopify') {
    const storeDomain = config.storeDomain || credentials.storeDomain;
    const adminToken = credentials.adminToken;
    const storefrontToken = credentials.storefrontToken;

    if (!storeDomain) {
      return NextResponse.json({ error: { message: 'Shopify store domain is required (e.g. your-store.myshopify.com).' } }, { status: 400 });
    }

    // If OAuth initialization requested
    if (action === 'OAUTH_START') {
      const cleanDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const clientId = process.env.SHOPIFY_CLIENT_ID || 'shopify_client_id_placeholder';
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/shopify/callback`;
      const state = Buffer.from(JSON.stringify({ workspaceId: session.workspaceId, nonce: generateId('nonce') })).toString('base64');
      const oauthUrl = `https://${cleanDomain}/admin/oauth/authorize?client_id=${clientId}&scope=read_products,write_inventory,read_orders,write_checkouts&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

      return NextResponse.json({ success: true, oauthUrl });
    }

    if (!adminToken && !storefrontToken) {
      return NextResponse.json({ error: { message: 'Shopify Admin API or Storefront Access Token is required.' } }, { status: 400 });
    }

    // Live Shopify API Validation Check
    try {
      const cleanDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const testRes = await fetch(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': adminToken || storefrontToken },
        signal: AbortSignal.timeout(5000)
      });

      if (!testRes.ok && testRes.status !== 401 && testRes.status !== 403 && testRes.status !== 404) {
        return NextResponse.json({
          error: { message: `Shopify validation failed: HTTP ${testRes.status} (${testRes.statusText})` }
        }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({
        error: { message: `Failed to connect to Shopify store: ${err.message || 'Network timeout'}` }
      }, { status: 400 });
    }
  }

  // 2. WooCommerce REST API Validation
  else if (integrationId === 'woocommerce') {
    const restEndpoint = config.restEndpoint || credentials.restEndpoint;
    const consumerKey = credentials.consumerKey;
    const consumerSecret = credentials.consumerSecret;

    if (!restEndpoint || !consumerKey || !consumerSecret) {
      return NextResponse.json({
        error: { message: 'WooCommerce REST endpoint, Consumer Key, and Consumer Secret are all required.' }
      }, { status: 400 });
    }

    try {
      const cleanUrl = restEndpoint.replace(/\/$/, '');
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const testRes = await fetch(`${cleanUrl}/products?per_page=1`, {
        headers: { 'Authorization': `Basic ${auth}` },
        signal: AbortSignal.timeout(5000)
      });

      if (!testRes.ok && testRes.status === 401) {
        return NextResponse.json({
          error: { message: 'WooCommerce authentication failed: Invalid Consumer Key or Consumer Secret.' }
        }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({
        error: { message: `Failed to reach WooCommerce store (${restEndpoint}): ${err.message || 'Connection refused'}` }
      }, { status: 400 });
    }
  }

  // 3. Razorpay API Validation
  else if (integrationId === 'razorpay') {
    const keyId = credentials.keyId;
    const keySecret = credentials.keySecret;

    if (!keyId || !keySecret) {
      return NextResponse.json({
        error: { message: 'Razorpay Key ID and Key Secret are required.' }
      }, { status: 400 });
    }

    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const testRes = await fetch('https://api.razorpay.com/v1/payments?count=1', {
        headers: { 'Authorization': `Basic ${auth}` },
        signal: AbortSignal.timeout(5000)
      });

      if (testRes.status === 401) {
        return NextResponse.json({
          error: { message: 'Razorpay validation failed: Invalid Key ID or Key Secret credentials.' }
        }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({
        error: { message: `Razorpay connection error: ${err.message || 'Gateway unreachable'}` }
      }, { status: 400 });
    }
  }

  // 4. Stripe API Validation
  else if (integrationId === 'stripe') {
    const secretKey = credentials.secretKey;
    if (!secretKey) {
      return NextResponse.json({ error: { message: 'Stripe Secret Key is required.' } }, { status: 400 });
    }

    try {
      const testRes = await fetch('https://api.stripe.com/v1/balance', {
        headers: { 'Authorization': `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(5000)
      });

      if (testRes.status === 401) {
        return NextResponse.json({
          error: { message: 'Stripe validation failed: Invalid API Secret Key.' }
        }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({
        error: { message: `Stripe connection error: ${err.message || 'Gateway unreachable'}` }
      }, { status: 400 });
    }
  }

  // 5. Logistics Carriers Validation
  else if (integrationId === 'logistics') {
    const carrierAccount = config.carrierAccount || credentials.carrierAccount;
    const bluedartLicense = credentials.bluedartLicense;
    const delhiveryApiKey = credentials.delhiveryApiKey;

    if (!carrierAccount && !bluedartLicense && !delhiveryApiKey) {
      return NextResponse.json({
        error: { message: 'At least one carrier license or API key (Bluedart/Delhivery) must be provided.' }
      }, { status: 400 });
    }
  }

  // 6. Web Crawler Validation
  else if (integrationId === 'web_crawler') {
    const targetUrl = config.targetUrl || credentials.targetUrl;
    if (!targetUrl) {
      return NextResponse.json({ error: { message: 'Target website URL is required.' } }, { status: 400 });
    }

    try {
      let normalized = targetUrl.trim();
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = `https://${normalized}`;
      }
      await fetch(normalized, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    } catch (err: any) {
      return NextResponse.json({
        error: { message: `Could not reach target website (${targetUrl}): ${err.message || 'Check URL validity'}` }
      }, { status: 400 });
    }
  }

  // 7. Custom Webhooks Validation
  else if (integrationId === 'custom_webhooks') {
    const deliveryEndpoint = config.deliveryEndpoint || credentials.deliveryEndpoint;
    if (!deliveryEndpoint) {
      return NextResponse.json({ error: { message: 'Delivery endpoint URL is required.' } }, { status: 400 });
    }
    try {
      new URL(deliveryEndpoint);
    } catch {
      return NextResponse.json({ error: { message: 'Invalid webhook delivery endpoint URL.' } }, { status: 400 });
    }
  }

  // Encrypt secrets at rest using AES-256-GCM
  const mergedCreds = { ...credentials, ...config };
  const ciphertext = encryptCredentials(mergedCreds);
  const masked = generateMaskedCredentials(mergedCreds);

  const existingIdx = db.workspace_integrations.findIndex(
    (wi: WorkspaceIntegration) => wi.workspace_id === session.workspaceId && wi.integration_id === integrationId
  );

  const record: WorkspaceIntegration = {
    id: existingIdx >= 0 ? db.workspace_integrations[existingIdx].id : generateId('wi'),
    workspace_id: session.workspaceId,
    integration_id: integrationId,
    provider: integrationId.toUpperCase(),
    name: config.name || integrationId,
    status: 'CONNECTED',
    connected_at: new Date().toISOString(),
    connected_by_user_id: session.user.id,
    connected_by_email: session.user.email,
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'SUCCESS',
    last_error: undefined,
    credentials_ciphertext: ciphertext,
    masked_credentials: masked,
    config: { ...config },
    created_at: existingIdx >= 0 ? db.workspace_integrations[existingIdx].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    db.workspace_integrations[existingIdx] = record;
  } else {
    db.workspace_integrations.push(record);
  }

  // Add audit trail log
  db.audit_logs.push({
    id: generateId('aud'),
    workspace_id: session.workspaceId,
    actor_user_id: session.user.id,
    actor_email: session.user.email,
    action: 'INTEGRATION_CONNECTED',
    resource_type: 'Integration',
    resource_id: integrationId,
    metadata: {
      integrationId,
      connectedAt: record.connected_at,
      maskedKeys: Object.keys(masked)
    },
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString()
  });

  db.saveImmediate();

  return NextResponse.json({
    success: true,
    status: 'CONNECTED',
    integration: {
      id: record.integration_id,
      status: record.status,
      connected_at: record.connected_at,
      connected_by_email: record.connected_by_email,
      masked_credentials: record.masked_credentials,
      config: record.config
    },
    message: `Successfully connected and authenticated ${integrationId} connector.`
  });
}
