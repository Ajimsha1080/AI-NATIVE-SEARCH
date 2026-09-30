import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { AiModeDeploymentService } from '@/ai-mode/services/deployment-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deployment = AiModeDeploymentService.getDeploymentById(id);
    if (!deployment || deployment.workspace_id !== session.workspaceId) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const hostUrl = `${protocol}://${host}`;
    const snippets = AiModeDeploymentService.generateEmbedSnippets(id, hostUrl);

    return NextResponse.json({ success: true, deployment, snippets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const existing = AiModeDeploymentService.getDeploymentById(id);
    if (!existing || existing.workspace_id !== session.workspaceId) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const updated = AiModeDeploymentService.saveDeployment({
      ...existing,
      ...body,
      id,
      workspace_id: session.workspaceId,
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, deployment: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const removed = AiModeDeploymentService.removeDeployment(id, session.workspaceId);
    if (!removed) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
