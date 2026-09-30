import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { AiModeDeploymentService } from '@/ai-mode/services/deployment-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deployments = AiModeDeploymentService.getDeployments(session.workspaceId);
    return NextResponse.json({ success: true, deployments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const deploymentId = body.id || `aimode_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const saved = AiModeDeploymentService.saveDeployment({
      id: deploymentId,
      workspace_id: session.workspaceId,
      name: body.name || 'AI Mode Widget',
      status: body.status || 'LIVE',
      allowed_domains: body.allowed_domains || ['*'],
      theme: body.theme || {
        primary_color: '#4f46e5',
        theme_mode: 'light',
        position: 'bottom-right',
        launcher_style: 'bubble',
        launcher_text: 'Shop with AI',
        widget_title: 'ShopMate AI Assistant',
        welcome_message: 'Hi there! What can I help you find today?',
        placeholder_text: 'Ask anything...',
        starter_prompts: ['Find gift ideas', 'Show new arrivals'],
        show_branding: true
      },
      created_at: body.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, deployment: saved }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
