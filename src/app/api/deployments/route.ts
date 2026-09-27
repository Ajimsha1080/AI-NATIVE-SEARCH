import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { Deployment } from '@/types';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const deployments = db.deployments.filter(d => d.workspace_id === session.workspaceId);
  return NextResponse.json({ deployments });
}

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  try {
    const { agent_id, channel, environment, allowed_domains } = await req.json();
    const agent = db.agents.find(a => a.id === agent_id && a.workspace_id === session.workspaceId);
    if (!agent) return NextResponse.json({ error: { message: 'Agent not found' } }, { status: 404 });

    const newDep: Deployment = {
      id: generateId('dep'),
      workspace_id: session.workspaceId,
      agent_id: agent.id,
      agent_version_id: agent.current_version_id || 'v1.0',
      channel: channel || 'WEBSITE',
      environment: environment || 'PRODUCTION',
      public_key: 'pk_live_' + generateId('key'),
      status: 'ACTIVE',
      allowed_domains: allowed_domains || ['*'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.deployments.push(newDep);
    db.saveImmediate();
    return NextResponse.json({ success: true, deployment: newDep });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Deployment creation failed' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  try {
    const { id, status, channel, environment, allowed_domains } = await req.json();
    const dep = db.deployments.find(d => d.id === id && d.workspace_id === session.workspaceId);
    if (!dep) return NextResponse.json({ error: { message: 'Deployment not found' } }, { status: 404 });

    if (status) dep.status = status;
    if (channel) dep.channel = channel;
    if (environment) dep.environment = environment;
    if (allowed_domains) dep.allowed_domains = allowed_domains;
    dep.updated_at = new Date().toISOString();

    db.saveImmediate();
    return NextResponse.json({ success: true, deployment: dep });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Deployment update failed' } }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const idx = db.deployments.findIndex(d => d.id === id && d.workspace_id === session.workspaceId);
  if (idx >= 0) {
    db.deployments.splice(idx, 1);
    db.saveImmediate();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: { message: 'Deployment not found' } }, { status: 404 });
}

