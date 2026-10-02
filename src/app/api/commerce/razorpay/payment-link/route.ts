import { NextResponse } from 'next/server';
import { razorpayService } from '@/lib/payments/razorpay';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amount,
      currency = 'INR',
      description = 'ShopMate AI Order Payment',
      customerName = 'Valued Customer',
      customerEmail = 'customer@gmail.com',
      customerPhone = '+919876543210',
      productId,
      variantId,
      quantity = 1,
      workspaceId = 'ws_acme_corp'
    } = body;

    let finalAmount = amount;
    let desc = description;

    if (productId) {
      const product = db.commerce_products.find(p => p.id === productId || (p.workspace_id === workspaceId && p.id === productId));
      if (product) {
        const variant = product.variants?.find(v => v.id === variantId) || product.variants?.[0];
        const unitPrice = variant?.price || product.price;
        finalAmount = unitPrice * Math.max(1, Number(quantity) || 1);
        desc = `Payment for ${product.title} (Qty: ${quantity})`;
      }
    }

    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: { message: 'Valid amount required for Razorpay Payment Link' } }, { status: 400 });
    }

    const paymentLink = await razorpayService.createPaymentLink({
      amount: finalAmount,
      currency,
      description: desc,
      customer: {
        name: customerName,
        email: customerEmail,
        contact: customerPhone
      },
      notes: {
        workspaceId,
        productId: productId || '',
        variantId: variantId || '',
        quantity: String(quantity)
      }
    });

    return NextResponse.json({
      success: true,
      payment_link: paymentLink,
      message: `Razorpay payment link generated for ₹${finalAmount.toLocaleString('en-IN')}`
    });
  } catch (err: any) {
    console.error('Razorpay Payment Link creation error:', err);
    return NextResponse.json({ error: { message: err.message || 'Failed to create payment link' } }, { status: 500 });
  }
}
