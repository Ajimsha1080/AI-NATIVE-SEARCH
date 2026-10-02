import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { commerceEngine } from '@/lib/commerce';
import { CommerceOrder } from '@/types';

const orderRateLimitMap = new Map<string, number[]>();

function checkOrderRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const timestamps = (orderRateLimitMap.get(key) || []).filter(ts => now - ts < windowMs);
  if (timestamps.length >= limit) {
    return false;
  }
  timestamps.push(now);
  orderRateLimitMap.set(key, timestamps);
  return true;
}

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local_ip';
  const rateLimitKey = `${clientIp}:${session.workspaceId}`;
  if (!checkOrderRateLimit(rateLimitKey, 10, 60000)) {
    return NextResponse.json(
      { error: { message: 'Too many order lookup requests. Please retry in a few moments.' } },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('order_number');
  const customerEmail = searchParams.get('customer_email');

  if (orderNumber) {
    if (!customerEmail) {
      return NextResponse.json(
        { error: { message: 'Both order_number and customer_email are required.' } },
        { status: 400 }
      );
    }
    const order = await commerceEngine.getOrder(session.workspaceId, orderNumber, customerEmail);
    if (!order) {
      return NextResponse.json(
        { error: { message: 'Order not found with the provided email address.' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ order });
  }

  const orders = db.commerce_orders.filter(o => o.workspace_id === session.workspaceId);
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    const body = await req.json();
    const workspaceId = body.workspace_id || session?.workspaceId || 'ws_acme_corp';
    const { productId, variantId, quantity = 1, customerName, customerEmail, shippingAddress, paymentMethod = 'UPI' } = body;

    const product = db.commerce_products.find(p => p.id === productId || (p.workspace_id === workspaceId && p.id === productId));
    if (!product) {
      return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 });
    }

    const variant = product.variants?.find(v => v.id === variantId || v.attributes?.size === variantId) || product.variants?.[0];
    const unitPrice = variant?.price || product.price;
    const qty = Math.max(1, Number(quantity) || 1);

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#ORD-${randomSuffix}`;

    const newOrder: CommerceOrder = {
      id: `ord_${Date.now()}`,
      workspace_id: workspaceId,
      order_number: orderNumber,
      customer_id: `cus_${Date.now().toString(36)}`,
      customer_email: (customerEmail || 'customer@gmail.com').toLowerCase().trim(),
      customer_name: customerName || 'Valued Customer',
      total_amount: unitPrice * qty,
      currency: product.currency || 'INR',
      status: paymentMethod === 'COD' ? 'PROCESSING' : 'PAID',
      payment_status: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      fulfillment_status: 'UNFULFILLED',
      shipping_address: shippingAddress || 'Address on file',
      tracking_number: `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-IN`,
      carrier: 'Bluedart Express',
      items: [
        {
          product_id: product.id,
          variant_id: variant?.id,
          title: product.title + (variant ? ` (${variant.title || 'Standard'})` : ''),
          quantity: qty,
          price: unitPrice
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.commerce_orders.unshift(newOrder);
    db.scheduleSave();

    return NextResponse.json({ success: true, order: newOrder });
  } catch (e: any) {
    return NextResponse.json({ error: { message: e.message || 'Failed to create order' } }, { status: 500 });
  }
}



