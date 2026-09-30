import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { AiModeChatService } from '@/ai-mode/services/chat-service';
import { AiModeDeploymentService } from '@/ai-mode/services/deployment-service';
import { aiModeStorage } from '@/ai-mode/services/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, deploymentId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    let targetWorkspaceId: string | null = null;

    // Check if called via authenticated dashboard session
    const session = await getAuthSession(req);
    if (session) {
      targetWorkspaceId = session.workspaceId;
    } else if (deploymentId) {
      // Called via public widget with deploymentId
      const deployment = AiModeDeploymentService.getDeploymentById(deploymentId);
      if (!deployment || deployment.status === 'PAUSED') {
        return NextResponse.json({ error: 'Deployment inactive or not found' }, { status: 403 });
      }

      // Check domain origin restrictions
      const origin = req.headers.get('origin') || req.headers.get('referer');
      if (!AiModeDeploymentService.isOriginAllowed(deployment, origin)) {
        return NextResponse.json({ error: 'Origin not allowed by deployment security settings' }, { status: 403 });
      }

      targetWorkspaceId = deployment.workspace_id;
    }

    if (!targetWorkspaceId) {
      return NextResponse.json({ error: 'Unauthorized or missing deployment ID' }, { status: 401 });
    }

    // Check if AI Mode is enabled for this workspace
    const config = aiModeStorage.getConfig(targetWorkspaceId);
    if (!config.enabled) {
      return NextResponse.json({
        error: 'AI Mode is currently disabled for this workspace.'
      }, { status: 403 });
    }

    const activeSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const result = await AiModeChatService.handleMessage(targetWorkspaceId, activeSessionId, message);

    return NextResponse.json({
      success: true,
      message: result.message,
      sessionId: activeSessionId
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
