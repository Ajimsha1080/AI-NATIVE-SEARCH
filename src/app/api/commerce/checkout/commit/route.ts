import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { commerceEngine } from '@/lib/commerce';
import { CommerceOrder } from '@/types';

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    const body = await req.json();

    const workspaceId = body.workspace_id || session?.workspaceId || 'ws_acme_corp';
    const { 
      productId, 
      variantId, 
      quantity = 1, 
      customerName, 
      customerEmail, 
      customerPhone,
      shippingAddress, 
      city, 
      state, 
      pincode, 
      paymentMethod = 'UPI' 
    } = body;

    if (!productId) {
      return NextResponse.json({ error: { message: 'Product ID is required for checkout' } }, { status: 400 });
    }

    if (!customerEmail || !customerName || !shippingAddress) {
      return NextResponse.json({ error: { message: 'Customer name, email, and shipping address are required.' } }, { status: 400 });
    }

    // 1. Resolve Product & Variant
    const product = db.commerce_products.find(p => p.id === productId || p.workspace_id === workspaceId && p.id === productId);
    if (!product) {
      return NextResponse.json({ error: { message: 'Product not found in store catalog' } }, { status: 404 });
    }

    const variant = product.variants?.find(v => v.id === variantId || v.attributes?.size === variantId) || product.variants?.[0];
    const unitPrice = variant?.price || product.price;
    const qty = Math.max(1, Number(quantity) || 1);
    const totalAmount = unitPrice * qty;

    // 2. Availability Check
    if (!product.in_stock && product.total_inventory <= 0) {
      return NextResponse.json({ error: { message: 'Item is currently out of stock' } }, { status: 400 });
    }

    // 3. Create & Persist Order
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#ORD-${randomSuffix}`;
    const trackingNumber = `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-IN`;
    const fullAddress = `${shippingAddress}, ${city || 'Bengaluru'}, ${state || 'Karnataka'} - ${pincode || '560001'}`;

    const newOrder: CommerceOrder = {
      id: `ord_${Date.now()}`,
      workspace_id: workspaceId,
      order_number: orderNumber,
      customer_id: `cus_${Date.now().toString(36)}`,
      customer_email: customerEmail.toLowerCase().trim(),
      customer_name: customerName.trim(),
      total_amount: totalAmount,
      currency: product.currency || 'INR',
      status: paymentMethod === 'COD' ? 'PROCESSING' : 'PAID',
      payment_status: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      fulfillment_status: 'UNFULFILLED',
      shipping_address: fullAddress,
      tracking_number: trackingNumber,
      carrier: 'Bluedart Express',
      items: [
        {
          product_id: product.id,
          variant_id: variant?.id,
          title: product.title + (variant ? ` (${variant.title || variant.attributes?.size || 'Standard'})` : ''),
          quantity: qty,
          price: unitPrice
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.commerce_orders.unshift(newOrder);
    db.scheduleSave();

    return NextResponse.json({
      success: true,
      order: newOrder,
      message: `Order ${orderNumber} placed successfully.`
    });
  } catch (err: any) {
    console.error('Checkout commit error:', err);
    return NextResponse.json({ error: { message: err.message || 'Checkout failed' } }, { status: 500 });
  }
}
