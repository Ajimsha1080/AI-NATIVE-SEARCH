import { NextResponse } from 'next/server';
import { AIModeDeploymentService } from '@/ai-mode/services/deployment-service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deployment = AIModeDeploymentService.getDeploymentById(id);
    if (!deployment) return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    return NextResponse.json({ success: true, deployment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching deployment' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const updated = AIModeDeploymentService.updateDeployment(id, body);
    if (!updated) return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    return NextResponse.json({ success: true, deployment: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
