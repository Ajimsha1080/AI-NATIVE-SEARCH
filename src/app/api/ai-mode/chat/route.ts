import { NextResponse } from 'next/server';
import { AIModeChatService } from '@/ai-mode/services/chat-service';
import { getAuthSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    const body = await req.json().catch(() => ({}));
    const { message, conversation_id, workspace_id } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message string is required' }, { status: 400 });
    }

    const wsId = session?.workspaceId || workspace_id || 'ws_acme_corp';
    const result = await AIModeChatService.processMessage({
      conversationId: conversation_id,
      workspaceId: wsId,
      userMessage: message
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chat service error' }, { status: 500 });
  }
}
