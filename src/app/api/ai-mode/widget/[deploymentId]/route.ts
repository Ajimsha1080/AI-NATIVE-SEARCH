import { NextResponse } from 'next/server';
import { AIModeDeploymentService } from '@/ai-mode/services/deployment-service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const deployment = AIModeDeploymentService.getDeploymentById(deploymentId);
    if (!deployment || deployment.status === 'PAUSED') {
      return NextResponse.json({ error: 'Widget deployment is not active' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deployment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching widget' }, { status: 500 });
  }
}
