import { NextResponse } from 'next/server';
import { razorpayService } from '@/lib/payments/razorpay';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, variantId, quantity = 1, amount, currency = 'INR', customerName, customerEmail, customerPhone, workspaceId = 'ws_acme_corp' } = body;

    let finalAmount = amount;

    // Resolve product price if not directly supplied
    if (!finalAmount && productId) {
      const product = db.commerce_products.find(p => p.id === productId || (p.workspace_id === workspaceId && p.id === productId));
      if (!product) {
        return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 });
      }
      const variant = product.variants?.find(v => v.id === variantId || v.attributes?.size === variantId) || product.variants?.[0];
      const unitPrice = variant?.price || product.price || 0;
      finalAmount = unitPrice * Math.max(1, Number(quantity) || 1);
    }

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: { message: 'Valid amount is required to initiate Razorpay order' } }, { status: 400 });
    }

    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const order = await razorpayService.createOrder({
      amount: finalAmount,
      currency,
      receipt,
      notes: {
        workspaceId,
        productId: productId || '',
        variantId: variantId || '',
        quantity: String(quantity),
        customerName: customerName || '',
        customerEmail: customerEmail || ''
      },
      customer: {
        name: customerName,
        email: customerEmail,
        contact: customerPhone
      }
    });

    return NextResponse.json({
      success: true,
      order,
      key_id: razorpayService.getKeyId(),
      is_sandbox: razorpayService.isSandbox()
    });
  } catch (err: any) {
    console.error('Razorpay order creation error:', err);
    return NextResponse.json({ error: { message: err.message || 'Failed to create Razorpay order' } }, { status: 500 });
  }
}
