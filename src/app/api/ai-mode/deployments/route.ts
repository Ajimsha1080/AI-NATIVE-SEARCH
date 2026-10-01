import { NextResponse } from 'next/server';
import { AIModeDeploymentService } from '@/ai-mode/services/deployment-service';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    const wsId = session?.workspaceId || 'ws_acme_corp';
    const deployments = AIModeDeploymentService.getDeployments(wsId);
    return NextResponse.json({ success: true, deployments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch deployments' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    const wsId = session?.workspaceId || 'ws_acme_corp';
    const body = await req.json().catch(() => ({}));
    const { name, allowed_domains } = body;

    if (!name) return NextResponse.json({ error: 'Deployment name is required' }, { status: 400 });

    const deployment = AIModeDeploymentService.createDeployment({
      workspaceId: wsId,
      name,
      allowed_domains
    });

    return NextResponse.json({ success: true, deployment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create deployment' }, { status: 500 });
  }
}
