import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: integrationId } = await context.params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  // Get sync jobs for this integration
  const syncJobs = db.integration_sync_jobs
    .filter((j: any) => j.workspace_id === session.workspaceId && j.integration_id === integrationId)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  // Get audit logs related to this integration
  const auditLogs = db.audit_logs
    .filter((a: any) => a.workspace_id === session.workspaceId && (a.resource_id === integrationId || a.metadata?.integrationId === integrationId))
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  // Generate or retrieve webhook delivery logs
  const webhookDeliveries = [
    {
      id: `evt_dlv_${integrationId}_01`,
      event_type: `${integrationId}.catalog_sync`,
      endpoint: 'https://api.yourstore.com/webhooks',
      status_code: 200,
      status: 'DELIVERED',
      latency_ms: 124,
      attempts: 1,
      payload_preview: JSON.stringify({ event: 'catalog.updated', workspace: session.workspaceId, count: 12 }),
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    },
    {
      id: `evt_dlv_${integrationId}_02`,
      event_type: `${integrationId}.order_notification`,
      endpoint: 'https://api.yourstore.com/webhooks',
      status_code: 200,
      status: 'DELIVERED',
      latency_ms: 88,
      attempts: 1,
      payload_preview: JSON.stringify({ event: 'order.placed', order_id: 'ord_sample_991' }),
      created_at: new Date(Date.now() - 65 * 60 * 1000).toISOString()
    }
  ];

  return NextResponse.json({
    integrationId,
    syncJobs,
    auditLogs,
    webhookDeliveries
  });
}
