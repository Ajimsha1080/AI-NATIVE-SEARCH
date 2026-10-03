import { NextResponse } from 'next/server';
import { aiModeStorage } from '@/ai-mode/services/storage';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { event, product_id, source_url, query, deployment_id, workspace_id } = body;

    if (!event || !product_id) {
      return NextResponse.json({ error: 'Missing required event or product_id' }, { status: 400 });
    }

    // Update deployment click metrics if applicable
    if (deployment_id) {
      const dep = aiModeStorage.getDeploymentById(deployment_id);
      if (dep) {
        aiModeStorage.updateDeployment(deployment_id, {
          total_product_clicks: (dep.total_product_clicks || 0) + 1
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      event, 
      product_id,
      recorded_at: new Date().toISOString() 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Tracking failed' }, { status: 500 });
  }
}
