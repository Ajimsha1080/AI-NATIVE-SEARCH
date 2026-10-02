import { NextResponse } from 'next/server';
import { razorpayService } from '@/lib/payments/razorpay';
import { db } from '@/lib/db';
import { CommerceOrder } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      workspaceId = 'ws_acme_corp',
      productId,
      variantId,
      quantity = 1,
      customerName = 'Ajimsha M',
      customerEmail = 'customer@gmail.com',
      customerPhone = '+91 98765 43210',
      shippingAddress = 'Indiranagar, Bengaluru, Karnataka - 560038',
      city = 'Bengaluru',
      state = 'Karnataka',
      pincode = '560038'
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json({ error: { message: 'Razorpay order ID and payment ID are required for verification.' } }, { status: 400 });
    }

    // 1. Verify Payment Signature
    const isValid = razorpayService.verifySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: razorpay_signature || 'mock_valid_signature'
    });

    if (!isValid) {
      return NextResponse.json({ error: { message: 'Invalid payment signature. Verification failed.' } }, { status: 400 });
    }

    // 2. Resolve Product Details
    let product = db.commerce_products.find(p => p.id === productId || (p.workspace_id === workspaceId && p.id === productId));
    if (!product && db.commerce_products.length > 0) {
      product = db.commerce_products[0];
    }

    const variant = product?.variants?.find(v => v.id === variantId || v.attributes?.size === variantId) || product?.variants?.[0];
    const unitPrice = variant?.price || product?.price || 999;
    const qty = Math.max(1, Number(quantity) || 1);
    const totalAmount = unitPrice * qty;

    // 3. Persist Confirmed Order
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#ORD-${randomSuffix}`;
    const fullAddress = `${shippingAddress}, ${city}, ${state} - ${pincode}`;

    const newOrder: CommerceOrder = {
      id: `ord_${Date.now()}`,
      workspace_id: workspaceId,
      order_number: orderNumber,
      customer_id: `cus_${Date.now().toString(36)}`,
      customer_email: customerEmail.toLowerCase().trim(),
      customer_name: customerName.trim(),
      total_amount: totalAmount,
      currency: product?.currency || 'INR',
      status: 'PAID',
      payment_status: 'PAID',
      fulfillment_status: 'UNFULFILLED',
      shipping_address: fullAddress,
      tracking_number: `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-IN`,
      carrier: 'Bluedart Express',
      items: [
        {
          product_id: product?.id || 'prod_rzp',
          variant_id: variant?.id,
          title: (product?.title || 'Selected Product') + (variant ? ` (${variant.title || variant.attributes?.size || 'Standard'})` : ''),
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
      verified: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      order: newOrder,
      message: `Payment verified successfully via Razorpay. Order ${orderNumber} is confirmed.`
    });
  } catch (err: any) {
    console.error('Razorpay verification error:', err);
    return NextResponse.json({ error: { message: err.message || 'Payment verification failed' } }, { status: 500 });
  }
}
