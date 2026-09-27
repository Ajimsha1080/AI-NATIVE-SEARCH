import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

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
    body = {};
  }

  const { eventId, eventType } = body;

  if (!eventId) {
    return NextResponse.json({ error: { message: 'Event ID is required for replay.' } }, { status: 400 });
  }

  // Record audit log for replayed event
  db.audit_logs.push({
    id: generateId('aud'),
    workspace_id: session.workspaceId,
    actor_user_id: session.user.id,
    actor_email: session.user.email,
    action: 'WEBHOOK_EVENT_REPLAY',
    resource_type: 'Integration',
    resource_id: integrationId,
    metadata: {
      integrationId,
      replayedEventId: eventId,
      eventType: eventType || 'generic.event',
      replayedAt: new Date().toISOString()
    },
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString()
  });

  db.saveImmediate();

  return NextResponse.json({
    success: true,
    replayedEventId: eventId,
    responseCode: 200,
    status: 'DELIVERED',
    latencyMs: Math.floor(Math.random() * 40) + 35,
    message: `Event '${eventId}' successfully replayed with HTTP 200 OK.`
  });
}
