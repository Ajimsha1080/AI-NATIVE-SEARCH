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

  const existingIdx = db.workspace_integrations.findIndex(
    (wi: any) => wi.workspace_id === session.workspaceId && wi.integration_id === integrationId
  );

  if (existingIdx >= 0) {
    // Revoke locally and reset to NOT_CONNECTED
    db.workspace_integrations[existingIdx] = {
      ...db.workspace_integrations[existingIdx],
      status: 'NOT_CONNECTED',
      credentials_ciphertext: undefined,
      masked_credentials: {},
      config: {},
      connected_at: undefined,
      connected_by_user_id: undefined,
      connected_by_email: undefined,
      last_sync_status: undefined,
      last_error: undefined,
      updated_at: new Date().toISOString()
    };
  }

  // Add audit trail log
  db.audit_logs.push({
    id: generateId('aud'),
    workspace_id: session.workspaceId,
    actor_user_id: session.user.id,
    actor_email: session.user.email,
    action: 'INTEGRATION_DISCONNECTED',
    resource_type: 'Integration',
    resource_id: integrationId,
    metadata: {
      integrationId,
      disconnectedAt: new Date().toISOString()
    },
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString()
  });

  db.saveImmediate();

  return NextResponse.json({
    success: true,
    status: 'NOT_CONNECTED',
    message: `Successfully disconnected and revoked credentials for ${integrationId}.`
  });
}
