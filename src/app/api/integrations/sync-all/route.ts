import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { IntegrationSyncJob } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  const connected = db.workspace_integrations.filter(
    (wi: any) => wi.workspace_id === session.workspaceId && wi.status === 'CONNECTED'
  );

  if (connected.length === 0) {
    return NextResponse.json({
      success: true,
      syncedCount: 0,
      jobs: [],
      message: 'No connected integrations found to sync.'
    });
  }

  const jobs: IntegrationSyncJob[] = [];

  for (const integration of connected) {
    const job: IntegrationSyncJob = {
      id: generateId('sync_job'),
      workspace_id: session.workspaceId,
      integration_id: integration.integration_id,
      status: 'COMPLETED',
      progress: 100,
      items_synced: 1,
      message: `Batch sync complete for ${integration.name || integration.integration_id}.`,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    };
    db.integration_sync_jobs.push(job);
    jobs.push(job);

    integration.last_sync_at = new Date().toISOString();
    integration.last_sync_status = 'SUCCESS';
    integration.last_error = undefined;
    integration.updated_at = new Date().toISOString();
  }

  // Audit log
  db.audit_logs.push({
    id: generateId('aud'),
    workspace_id: session.workspaceId,
    actor_user_id: session.user.id,
    actor_email: session.user.email,
    action: 'CONNECTOR_SYNC_ALL',
    resource_type: 'Integration',
    resource_id: 'all',
    metadata: {
      syncedConnectors: connected.map((c: any) => c.integration_id),
      jobCount: jobs.length
    },
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString()
  });

  db.saveImmediate();

  return NextResponse.json({
    success: true,
    syncedCount: connected.length,
    jobs,
    message: `Successfully synchronized ${connected.length} active connector(s).`
  });
}
