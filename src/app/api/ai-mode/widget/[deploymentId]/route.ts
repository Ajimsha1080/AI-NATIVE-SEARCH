import { NextRequest, NextResponse } from 'next/server';
import { AiModeDeploymentService } from '@/ai-mode/services/deployment-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const deployment = AiModeDeploymentService.getDeploymentById(deploymentId);

    if (!deployment || deployment.status === 'PAUSED') {
      return NextResponse.json({ error: 'Deployment not found or inactive' }, { status: 404 });
    }

    const origin = req.headers.get('origin') || req.headers.get('referer');
    if (!AiModeDeploymentService.isOriginAllowed(deployment, origin)) {
      return NextResponse.json({ error: 'Unauthorized origin' }, { status: 403 });
    }

    // Return public safe configuration (no sensitive keys)
    return NextResponse.json({
      id: deployment.id,
      name: deployment.name,
      status: deployment.status,
      theme: deployment.theme
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
