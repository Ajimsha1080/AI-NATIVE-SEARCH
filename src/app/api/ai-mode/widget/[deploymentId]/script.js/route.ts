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
      return new NextResponse('/* AI Mode Widget is currently inactive */', {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
      });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const hostUrl = `${proto}://${host}`;

    const script = AIModeDeploymentService.generateScriptJs(deployment, hostUrl);

    return new NextResponse(script, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
      }
    });
  } catch (err) {
    return new NextResponse('/* AI Mode Widget Error */', {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
    });
  }
}
