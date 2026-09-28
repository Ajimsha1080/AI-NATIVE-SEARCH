import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { Message } from '@/types';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const conversations = db.conversations
    .filter(c => c.workspace_id === session.workspaceId)
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  try {
    const { conversation_id, message, action } = await req.json();
    const conv = db.conversations.find(c => c.id === conversation_id && c.workspace_id === session.workspaceId);
    if (!conv) return NextResponse.json({ error: { message: 'Conversation not found' } }, { status: 404 });

    if (action === 'HUMAN_REPLY' && message) {
      if (!requireRole(session, ['OWNER', 'ADMIN'])) {
        return NextResponse.json({ error: { message: 'Forbidden: Only Owner or Admin can send operator messages as HUMAN.' } }, { status: 403 });
      }

      const humanMsg: Message = {
        id: generateId('msg'),
        conversation_id: conv.id,
        workspace_id: session.workspaceId,
        role: 'HUMAN',
        content: message,
        metadata: {
          operator_id: session.user.id,
          operator_name: session.user.name || 'Support Agent',
          channel: 'STAFF_CONSOLE'
        },
        created_at: new Date().toISOString()
      };
      db.messages.push(humanMsg);
      conv.message_count += 1;
      conv.updated_at = new Date().toISOString();
      conv.assigned_human_user_id = session.user.id;
      db.scheduleSave();
      return NextResponse.json({ success: true, message: humanMsg });
    }

    if (action === 'RESOLVE') {
      conv.status = 'RESOLVED';
      conv.updated_at = new Date().toISOString();
      db.scheduleSave();
      return NextResponse.json({ success: true, conversation: conv });
    }

    return NextResponse.json({ error: { message: 'Invalid action' } }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Operation failed' } }, { status: 500 });
  }
}

