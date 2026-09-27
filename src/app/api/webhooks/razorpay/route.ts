import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { logInfo, logWarn, logError } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (secret && !secret.includes('PLACEHOLDER')) {
    if (!signature) {
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }
    const expectedSig = crypto.createHmac('sha256', secret).update(bodyText).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      logWarn('Razorpay webhook signature mismatch');
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }
  }

  try {
    const payload = JSON.parse(bodyText);
    const eventId = payload.event_id || payload.payload?.payment?.entity?.id || `evt_${Date.now()}`;

    // Idempotency check
    const alreadyProcessed = db.processed_webhook_events.some(
      e => e.event_id === eventId && e.provider === 'RAZORPAY'
    );
    if (alreadyProcessed) {
      return NextResponse.json({ status: 'ok', deduplicated: true });
    }

    logInfo(`Processing Razorpay Event: ${payload.event}`);

    if (payload.event === 'payment.captured' || payload.event === 'order.paid' || payload.event === 'subscription.charged') {
      const paymentEntity = payload.payload?.payment?.entity || {};
      const notes = paymentEntity.notes || payload.payload?.subscription?.entity?.notes || {};
      const workspaceId = notes.workspace_id;
      const targetPlan = (notes.target_plan || notes.plan || 'GROWTH').toUpperCase();

      if (workspaceId) {
        const ws = db.workspaces.find(w => w.id === workspaceId);
        if (ws) {
          ws.plan = targetPlan as any;
          ws.subscription_status = 'active';
          ws.updated_at = new Date().toISOString();
          logInfo(`Workspace tier upgraded to ${targetPlan} for ${workspaceId}`);
        }
      }
    }

    db.processed_webhook_events.push({
      id: generateId('pwe'),
      event_id: eventId,
      provider: 'RAZORPAY',
      processed_at: new Date().toISOString()
    });

    db.saveImmediate();

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    logError('Error parsing Razorpay webhook', err);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 400 });
  }
}
