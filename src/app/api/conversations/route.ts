import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { Message } from '@/types';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  let conversations = db.conversations
    .filter(c => c.workspace_id === session.workspaceId);

  if (conversations.length === 0) {
    const sampleConvos = [
      {
        id: 'conv_live_8910',
        workspace_id: session.workspaceId,
        agent_id: 'agent_shopmate_01',
        customer_identifier: 'sarah.sharma@gmail.com',
        channel: 'WEBSITE' as const,
        status: 'ACTIVE' as const,
        message_count: 3,
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 60000).toISOString(),
      },
      {
        id: 'conv_live_8911',
        workspace_id: session.workspaceId,
        agent_id: 'agent_shopmate_01',
        customer_identifier: 'rahul.verma@gmail.com',
        channel: 'WEBSITE' as const,
        status: 'HUMAN_TAKEOVER' as const,
        message_count: 5,
        created_at: new Date(Date.now() - 25 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 60000).toISOString(),
      },
      {
        id: 'conv_live_8912',
        workspace_id: session.workspaceId,
        agent_id: 'agent_shopmate_01',
        customer_identifier: 'priya.patel@gmail.com',
        channel: 'WEBSITE' as const,
        status: 'RESOLVED' as const,
        message_count: 4,
        created_at: new Date(Date.now() - 60 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 15 * 60000).toISOString(),
      }
    ];

    const sampleMessages: Message[] = [
      // conv 8910
      {
        id: 'msg_8910_1',
        conversation_id: 'conv_live_8910',
        workspace_id: session.workspaceId,
        role: 'USER',
        content: 'Hi! I am looking for the UPF 50+ Sunscreen Performance Jacket in size Large Obsidian Black. Do you have it in stock?',
        created_at: new Date(Date.now() - 4 * 60000).toISOString()
      },
      {
        id: 'msg_8910_2',
        conversation_id: 'conv_live_8910',
        workspace_id: session.workspaceId,
        role: 'ASSISTANT',
        content: 'I checked our live inventory for you! We currently have 20 units of the UPF 50+ Sunscreen Performance Jacket (Large, Obsidian Black) in stock for ₹2,499 with free express shipping across India.',
        metadata: {
          products: [
            {
              id: 'prod_bt_01',
              title: 'UPF 50+ Sunscreen Performance Jacket',
              price: 2499.00,
              in_stock: true
            }
          ]
        },
        created_at: new Date(Date.now() - 3 * 60000).toISOString()
      },
      {
        id: 'msg_8910_3',
        conversation_id: 'conv_live_8910',
        workspace_id: session.workspaceId,
        role: 'USER',
        content: 'Awesome! Does it offer UV protection during humid weather?',
        created_at: new Date(Date.now() - 1 * 60000).toISOString()
      },

      // conv 8911
      {
        id: 'msg_8911_1',
        conversation_id: 'conv_live_8911',
        workspace_id: session.workspaceId,
        role: 'USER',
        content: 'I received order #10482 yesterday, but I need to exchange it for a size XL.',
        created_at: new Date(Date.now() - 20 * 60000).toISOString()
      },
      {
        id: 'msg_8911_2',
        conversation_id: 'conv_live_8911',
        workspace_id: session.workspaceId,
        role: 'ASSISTANT',
        content: "Under our 7-day hassle-free exchange policy, you can exchange your item at zero extra cost. Let me connect you with a specialist to confirm your pickup address.",
        created_at: new Date(Date.now() - 18 * 60000).toISOString()
      },
      {
        id: 'msg_8911_3',
        conversation_id: 'conv_live_8911',
        workspace_id: session.workspaceId,
        role: 'HUMAN',
        content: 'Hello Rahul! Support specialist here. I have scheduled a reverse pickup for your jacket and initiated the XL replacement dispatch. Delivery to Koramangala is estimated in 2 business days.',
        metadata: { operator_name: 'Alex (Staff)' },
        created_at: new Date(Date.now() - 10 * 60000).toISOString()
      },
      {
        id: 'msg_8911_4',
        conversation_id: 'conv_live_8911',
        workspace_id: session.workspaceId,
        role: 'USER',
        content: 'Thank you so much for the quick resolution!',
        created_at: new Date(Date.now() - 5 * 60000).toISOString()
      },

      // conv 8912
      {
        id: 'msg_8912_1',
        conversation_id: 'conv_live_8912',
        workspace_id: session.workspaceId,
        role: 'USER',
        content: 'Where is my order #10482?',
        created_at: new Date(Date.now() - 55 * 60000).toISOString()
      },
      {
        id: 'msg_8912_2',
        conversation_id: 'conv_live_8912',
        workspace_id: session.workspaceId,
        role: 'ASSISTANT',
        content: 'Order #10482 has been delivered! Carrier: Bluedart Express (Tracking: BD-8941039821-IN). Delivered to Indiranagar, Bengaluru.',
        created_at: new Date(Date.now() - 54 * 60000).toISOString()
      },
      {
        id: 'msg_8912_3',
        conversation_id: 'conv_live_8912',
        workspace_id: session.workspaceId,
        role: 'USER',
        content: 'Found it, thank you!',
        created_at: new Date(Date.now() - 50 * 60000).toISOString()
      }
    ];

    db.conversations.push(...(sampleConvos as any));
    db.messages.push(...sampleMessages);
    db.scheduleSave();
    conversations = db.conversations.filter(c => c.workspace_id === session.workspaceId);
  }

  conversations.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

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

