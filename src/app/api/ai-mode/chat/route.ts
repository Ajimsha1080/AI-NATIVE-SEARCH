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
    const pythonUrl = process.env.PYTHON_BACKEND_URL;

    if (pythonUrl) {
      try {
        const pyRes = await fetch(`${pythonUrl}/api/v1/ai-mode/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: wsId,
            user_message: message,
            conversation_id
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (pyRes.ok) {
          const pyData = await pyRes.json();
          return NextResponse.json({
            success: true,
            conversation: { id: pyData.conversation_id, messages: [] },
            responseMessage: {
              id: `msg_py_${Date.now()}`,
              role: 'assistant',
              content: pyData.content,
              products: pyData.products,
              recommendations: pyData.recommendations,
              created_at: pyData.created_at
            },
            backend: 'python-fastapi'
          });
        }
      } catch (pyErr) {
        console.warn('Python chat endpoint unavailable, falling back to native chat engine:', pyErr);
      }
    }

    const result = await AIModeChatService.processMessage({
      conversationId: conversation_id,
      workspaceId: wsId,
      userMessage: message
    });

    return NextResponse.json({ success: true, ...result, backend: 'native-typescript' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chat service error' }, { status: 500 });
  }
}
