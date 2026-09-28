import { NextResponse } from 'next/server';
import { getAuthSession, createServiceJwt } from '@/lib/auth';
import { db } from '@/lib/db';
import { runAgentCycle } from '@/lib/agent-runtime';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getAuthSession(req);
  let workspaceId = session?.workspaceId;
  if (!workspaceId) {
    const existingAgent = db.agents.find(a => a.id === id);
    workspaceId = existingAgent?.workspace_id || 'ws_acme_corp';
  }
  const userId = session?.user?.id || 'usr_guest_shopper';
  const userRole = session?.role || 'VIEWER';

  try {
    const body = await req.json();
    const message = body.message;
    const conversationId = body.conversationId || body.conversation_id;
    const channel = body.channel || 'PLAYGROUND';

    if (!message) {
      return NextResponse.json({ error: { message: 'Message cannot be empty' } }, { status: 400 });
    }

    const serviceToken = await createServiceJwt(workspaceId, userId, userRole);

    // 1. Direct proxy to Python FastAPI AI & RAG Engine of Record
    try {
      const pythonRes = await fetch(`${PYTHON_BACKEND_URL}/api/v1/agents/${id}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceToken}`
        },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          workspace_id: workspaceId,
          channel: channel
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (pythonRes.ok) {
        const pythonData = await pythonRes.json();
        return NextResponse.json({
          ...pythonData,
          conversationId: pythonData.conversation_id || conversationId,
          conversation_id: pythonData.conversation_id || conversationId,
          message_id: pythonData.message_id || 'msg_' + Math.random().toString(36).substring(2, 9),
          response: pythonData.response,
          interactive_payload: pythonData.interactive_payload,
          metadata: {
            products: pythonData.interactive_payload?.type === 'PRODUCTS' ? pythonData.interactive_payload.data : undefined,
            order: pythonData.interactive_payload?.type === 'ORDER' ? pythonData.interactive_payload.data : undefined,
          },
          trace: pythonData.trace
        });
      }
    } catch (pyErr) {
      // In local dev/fallback mode without external daemon, fallback to embedded runtime
    }

    // 2. Embedded Runtime Execution
    const result = await runAgentCycle({
      agent_id: id,
      user_message: message,
      workspace_id: workspaceId,
      conversation_id: conversationId,
      channel
    });

    return NextResponse.json({
      ...result,
      response: result.response_text,
      conversationId: result.conversation_id,
      metadata: {
        products: result.interactive_payload?.type === 'PRODUCTS' ? result.interactive_payload.data : undefined,
        order: result.interactive_payload?.type === 'ORDER_TRACKING' ? result.interactive_payload.data : undefined,
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Execution error' } }, { status: 500 });
  }
}
