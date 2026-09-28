import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const url = new URL(req.url);
  const actionFilter = url.searchParams.get('action');
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  let logs = db.audit_logs
    .filter(l => l.workspace_id === session.workspaceId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (actionFilter) {
    logs = logs.filter(l => l.action.toLowerCase() === actionFilter.toLowerCase());
  }

  const total = logs.length;
  const paginated = logs.slice(offset, offset + limit);

  return NextResponse.json({
    total,
    offset,
    limit,
    logs: paginated
  });
}
