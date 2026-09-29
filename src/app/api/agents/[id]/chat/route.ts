import { NextResponse } from 'next/server';
import { getAuthSession, createServiceJwt } from '@/lib/auth';
import { db } from '@/lib/db';
import { runAgentCycle } from '@/lib/agent-runtime';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

function resolveProductCards(responseText: string, userMessage: string, workspaceId: string, currentPayload?: any) {
  if (currentPayload?.type === 'PRODUCTS' && Array.isArray(currentPayload.data) && currentPayload.data.length > 0) {
    return currentPayload;
  }

  const respLower = (responseText || '').toLowerCase();
  const userLower = (userMessage || '').toLowerCase();
  const catalog = db.commerce_products.filter(p => p.workspace_id === workspaceId);
  const matched: any[] = [];

  // 1. Direct and multi-token matching with catalog products
  catalog.forEach(p => {
    const pTitle = p.title.toLowerCase();
    if (respLower.includes(pTitle)) {
      if (!matched.some(m => m.id === p.id)) matched.push(p);
    } else {
      const tokens = pTitle.split(/\s+/).filter(w => w.length >= 4);
      if (tokens.length >= 2 && tokens.every(tok => respLower.includes(tok))) {
        if (!matched.some(m => m.id === p.id)) matched.push(p);
      }
    }
  });

  // 2. Multi-line pattern matching (handles -, –, —, :, |, with or without price)
  const lineRegex = /(?:^|[\r\n]|•|\*|-)\s*([A-Za-z0-9\s&'()/-]{3,50}?)\s*(?:—|–|-|:)\s*(?:(?:₹|Rs\.?|\$)\s*([\d,]+)|([A-Za-z\s]{5,}))/gim;
  let match;
  while ((match = lineRegex.exec(responseText)) !== null) {
    const title = match[1].trim();
    let price = match[2] ? parseFloat(match[2].replace(/,/g, '')) : 1699;
    
    let existing = catalog.find(p => p.title.toLowerCase() === title.toLowerCase() || p.title.toLowerCase().includes(title.toLowerCase()));
    if (existing) {
      if (!matched.some(m => m.id === existing!.id)) matched.push(existing);
    } else if (title.length >= 4 && !/here are|if you|we also|let me|our active|feel free|for a festive/i.test(title)) {
      let categoryImg = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
      if (/kurta/i.test(title)) categoryImg = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
      else if (/shirt|tee/i.test(title)) categoryImg = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
      else if (/dress/i.test(title)) categoryImg = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80';

      const newProd = {
        id: `prod_dyn_${Math.random().toString(36).substring(2, 9)}`,
        workspace_id: workspaceId,
        title: title,
        description: `${title} available in our store collection.`,
        category: /saree/i.test(title) ? 'Sarees' : (/kurta/i.test(title) ? 'Kurtas' : (/combo/i.test(title) ? 'Combos' : 'Apparel')),
        price: price || 1699,
        currency: 'INR',
        images: [categoryImg],
        in_stock: true,
        total_inventory: 50,
        variants: [{ id: `var_${Math.random().toString(36).substring(2, 9)}`, sku: `SKU-${title.slice(0, 4).toUpperCase()}-M`, title: 'Free Size', price: price || 1699, inventory_quantity: 50, attributes: { size: 'Free Size' } }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.commerce_products.push(newProd);
      db.scheduleSave();
      matched.push(newProd);
    }
  }

  // 3. Category / user query matching (e.g. "festival dress", "women product", "sarees", "kurtas", "new products")
  if (matched.length === 0 && /product|dress|women|woman|men|saree|kurta|shirt|festive|festival|combo|new|latest/i.test(userLower)) {
    const tokens = userLower.split(/\s+/).filter(w => w.length > 2);
    const categoryMatches = catalog.filter(p => {
      const full = `${p.title} ${p.description} ${p.category} ${p.tags?.join(' ')}`.toLowerCase();
      return tokens.some(tok => full.includes(tok));
    });
    matched.push(...categoryMatches);

    if (matched.length === 0 && catalog.length > 0) {
      matched.push(...catalog.slice(0, 4));
    }
  }

  if (matched.length > 0) {
    return {
      type: 'PRODUCTS',
      data: matched.slice(0, 6)
    };
  }

  return currentPayload || null;
}

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
        const finalPayload = resolveProductCards(pythonData.response || '', message, workspaceId, pythonData.interactive_payload);
        return NextResponse.json({
          ...pythonData,
          conversationId: pythonData.conversation_id || conversationId,
          conversation_id: pythonData.conversation_id || conversationId,
          message_id: pythonData.message_id || 'msg_' + Math.random().toString(36).substring(2, 9),
          response: pythonData.response,
          interactive_payload: finalPayload,
          metadata: {
            products: finalPayload?.type === 'PRODUCTS' ? finalPayload.data : undefined,
            order: finalPayload?.type === 'ORDER_TRACKING' || finalPayload?.type === 'ORDER' ? finalPayload.data : undefined,
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

    const finalPayload = resolveProductCards(result.response_text || '', message, workspaceId, result.interactive_payload);

    return NextResponse.json({
      ...result,
      response: result.response_text,
      conversationId: result.conversation_id,
      interactive_payload: finalPayload,
      metadata: {
        products: finalPayload?.type === 'PRODUCTS' ? finalPayload.data : undefined,
        order: finalPayload?.type === 'ORDER_TRACKING' ? finalPayload.data : undefined,
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Execution error' } }, { status: 500 });
  }
}
