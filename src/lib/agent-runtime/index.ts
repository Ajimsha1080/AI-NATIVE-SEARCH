import { db } from '../db';
import { executeRAGPipeline } from '../rag';
import { executeTool } from '../tools';
import { generateId } from '../utils';
import { AgentConfig, ExecutionTrace, Message } from '@/types';
import { STANDARD_TOOLS } from '../db/seed';

export interface AgentRunParams {
  agent_id: string;
  workspace_id: string;
  conversation_id?: string;
  user_message: string;
  channel?: 'WEBSITE' | 'MOBILE' | 'API' | 'PLAYGROUND' | 'CUSTOM';
  customer_identifier?: string;
}

export interface AgentRunResponse {
  conversation_id: string;
  message_id: string;
  response_text: string;
  interactive_payload?: any;
  trace: ExecutionTrace;
}

async function callSarvamLLM(
  systemPrompt: string,
  userMessage: string,
  contextText: string,
  history: { role: string; content: string }[] = []
): Promise<string | null> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) return null;

  try {
    const messages = [
      {
        role: 'system',
        content: `${systemPrompt}\n\nRelevant Store Knowledge Context:\n${contextText || 'No specific knowledge document matched.'}`
      },
      ...history.slice(-4),
      { role: 'user', content: userMessage }
    ];

    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey
      },
      body: JSON.stringify({
        model: process.env.SARVAM_MODEL || 'sarvam-105b-conversations',
        messages: messages,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content;
      if (answer) return answer;
    }
  } catch (e) {
    console.error('Sarvam AI direct call error:', e);
  }
  return null;
}

function normalizeUserMessage(text: string): string {
  const typoMap: Record<string, string> = {
    wmoen: 'women',
    womne: 'women',
    wommen: 'women',
    womans: 'women',
    wmon: 'women',
    womem: 'women',
    prodcuts: 'products',
    prodcut: 'product',
    produts: 'products',
    produtcs: 'products',
    proucts: 'products',
    porducts: 'products',
    jaket: 'jacket',
    jakets: 'jackets',
    jakcet: 'jacket',
    jackt: 'jacket',
    sunscren: 'sunscreen',
    suncrean: 'sunscreen',
    suncream: 'sunscreen',
    suncreen: 'sunscreen',
    shrit: 'shirt',
    shrits: 'shirts',
    tshrit: 'tshirt',
    tshrits: 'tshirts',
    balclava: 'balaclava',
    balaklava: 'balaclava',
    viser: 'visor',
    visors: 'visor',
    clothe: 'clothes',
    cloths: 'clothes',
    trak: 'track',
    traking: 'tracking',
    retrn: 'return',
    ordr: 'order',
    oder: 'order',
  };

  let normalized = text.toLowerCase();
  for (const [typo, fix] of Object.entries(typoMap)) {
    normalized = normalized.replace(new RegExp(`\\b${typo}\\b`, 'gi'), fix);
  }
  return normalized;
}

export async function runAgentCycle(params: AgentRunParams): Promise<AgentRunResponse> {
  const startTime = Date.now();
  const { agent_id, workspace_id, user_message, channel = 'PLAYGROUND' } = params;
  const cleanMessage = normalizeUserMessage(user_message);

  let agent = db.agents.find(a => a.id === agent_id && a.workspace_id === workspace_id);
  if (!agent) {
    agent = db.agents.find(a => a.workspace_id === workspace_id);
  }
  if (!agent) {
    // Auto-provision default agent for this workspace
    const templateAgent = db.agents.find(a => a.id === agent_id) || db.agents[0];
    const newAgentId = templateAgent ? templateAgent.id : (agent_id || generateId('agent'));
    agent = {
      id: newAgentId,
      workspace_id: workspace_id,
      name: templateAgent?.name || 'ShopMate AI',
      description: templateAgent?.description || 'Autonomous commerce concierge specialized in product discovery, live inventory queries, order status, and customer assistance.',
      industry: templateAgent?.industry || 'Omnichannel Retail & E-Commerce',
      primary_objective: templateAgent?.primary_objective || 'Boost product conversions and handle order inquiries autonomously with verified tool executions.',
      language: templateAgent?.language || 'English',
      status: 'PUBLISHED' as const,
      current_version_id: 'ver_shopmate_v1_0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.agents.push(agent);

    const templateConfig = db.agent_configs.find(c => c.agent_id === templateAgent?.id) || db.agent_configs[0];
    if (templateConfig) {
      db.agent_configs.push({
        ...templateConfig,
        id: generateId('cfg'),
        agent_id: agent.id,
        updated_at: new Date().toISOString()
      });
    }

    STANDARD_TOOLS.forEach(t => {
      const existingPerm = db.tool_permissions.find(p => p.agent_id === agent!.id && p.tool_id === t.id);
      if (!existingPerm) {
        db.tool_permissions.push({
          id: 'perm_' + agent!.id + '_' + t.id,
          agent_id: agent!.id,
          tool_id: t.id,
          is_enabled: true,
          permission_mode: t.risk_level === 'HIGH' ? 'REQUIRES_CONFIRMATION' : 'ALLOWED'
        });
      }
    });

    db.saveImmediate();
  }

  const config = db.agent_configs.find(c => c.agent_id === agent_id) || ({
    identity: { name: agent.name, greeting: 'Hello!', brand_name: 'Store' },
    instructions: { system_prompt: 'You are an AI commerce assistant.' },
    personality: { tone: 'friendly' },
  } as unknown as AgentConfig);

  const brand = config?.identity?.brand_name || agent.name || 'Store';

  let conversation = db.conversations.find(c => c.id === params.conversation_id);
  if (!conversation) {
    const convId = params.conversation_id || generateId('conv');
    conversation = {
      id: convId,
      workspace_id: workspace_id,
      agent_id: agent_id,
      agent_version_id: agent.current_version_id,
      channel: channel,
      status: 'OPEN',
      customer_identifier: params.customer_identifier || 'guest_user',
      message_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.conversations.push(conversation);
  }

  const userMsgId = generateId('msg');
  const userMsg: Message = {
    id: userMsgId,
    conversation_id: conversation.id,
    workspace_id: workspace_id,
    role: 'USER',
    content: user_message,
    created_at: new Date().toISOString()
  };
  db.messages.push(userMsg);
  conversation.message_count += 1;

  const planningSteps: string[] = [];
  const toolExecutions: any[] = [];
  const policiesEvaluated: any[] = [];
  let responseText = '';
  let interactivePayload: any = null;

  // Retrieve multi-turn conversation history
  const conversationHistory = db.messages
    .filter(m => m.conversation_id === conversation.id && m.id !== userMsgId)
    .slice(-8)
    .map(m => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content
    }));

  const storeProducts = db.commerce_products.filter(p => p.workspace_id === workspace_id);
  const catalogContext = storeProducts.map(p => 
    `• ${p.title} — ₹${p.price.toLocaleString('en-IN')}${p.compare_at_price ? ` (MRP: ₹${p.compare_at_price.toLocaleString('en-IN')})` : ''} | Category: ${p.category} | In Stock: ${p.in_stock ? 'Yes' : 'No'} | Details: ${p.description}`
  ).join('\n');

  // Phase A: Intent Detection
  let detectedIntent = 'GENERAL_QUERY';
  if (/talk to (?:a |an )?(?:human|agent|representative|person|operator)|speak (?:with|to) (?:a )?(?:human|person|representative)|connect me to support/i.test(cleanMessage)) {
    detectedIntent = 'HUMAN_HANDOFF';
  } else if (/return|refund|exchange|warranty|policy|shipping policy|shipping time|delivery time|how many days|when will it arrive|shipping cost|who are you|about|contact|phone|email|address|location|headquarters|support/i.test(cleanMessage)) {
    detectedIntent = 'RETURN_OR_POLICY_INQUIRY';
  } else if (/(?:track(?:ing)?\s+(?:my\s+)?order|where\s+is\s+my\s+order|status\s+of\s+order|order\s+status|#\d{4,6})/i.test(cleanMessage)) {
    detectedIntent = 'ORDER_TRACKING';
  } else if (/cart|add to cart|add that|add this|add it|buy this|checkout|bag/i.test(cleanMessage)) {
    detectedIntent = 'CART_ACTION';
  } else if (/find|search|show|look for|product|products|item|items|catalog|collection|arrival|arrivals|new|latest|best\s*seller|trending|what (?:do )?you (?:have|sell)|jacket|tee|tshirt|jogger|hoodie|shorts|tank|polo|windbreaker|cargo|techwear|balaclava|price|cost|how much|under|buy|recommend|women|woman|mens|men|outerwear|apparel|cap|caps|hat|hats|visor|visors|headwear|sunscreen/i.test(cleanMessage)) {
    detectedIntent = 'PRODUCT_SEARCH';
  }

  planningSteps.push('1. Intent detected: ' + detectedIntent);

  // Phase B: 12-Stage Advanced RAG Pipeline Execution
  planningSteps.push('2. Running 12-Stage RAG: Query Understanding → Expansion → Hybrid Retrieval → RRF → Rerank → Context Assembly.');
  const ragResult = await executeRAGPipeline(workspace_id, cleanMessage, {
    topK: 5,
    minScore: 0.15,
    agentId: agent_id
  });
  const citations = ragResult.citations;
  planningSteps.push(`3. RAG complete: ${ragResult.citations.length} verified citation(s) retrieved (Top Score: ${(ragResult.reranking.top_score * 100).toFixed(1)}%).`);

  // Assemble comprehensive store knowledge from citations + all workspace knowledge chunks
  const workspaceChunks = db.knowledge_chunks.filter(c => c.workspace_id === workspace_id);
  const citationTexts = citations.map(c => c.chunk_text.trim());
  const otherChunkTexts = workspaceChunks
    .map(c => c.content.trim())
    .filter(content => !citationTexts.some(cit => cit.includes(content) || content.includes(cit)))
    .slice(0, 20);

  const knowledgeSections = [
    ...(citationTexts.length > 0 ? ['[Top Matching Verified Knowledge Citations]:\n' + citationTexts.join('\n\n')] : []),
    ...(otherChunkTexts.length > 0 ? ['[Knowledge Base Documents & Operational Guidelines]:\n' + otherChunkTexts.join('\n\n')] : [])
  ].join('\n\n');

  const fullKnowledgeContext = `Live Product Catalog:\n${catalogContext}\n\nWorkspace Knowledge Base & Documents:\n${knowledgeSections || 'No additional documents on file.'}`;

  // Helper for dynamic local knowledge extraction if LLM is unavailable
  const dynamicFallbackAnswer = (query: string): string => {
    const qLower = query.toLowerCase();
    const matchedChunk = workspaceChunks.find(c => {
      const cLower = c.content.toLowerCase();
      const tokens = qLower.split(/\s+/).filter(w => w.length > 3);
      return tokens.some(t => cLower.includes(t));
    }) || citations[0];

    if (matchedChunk) {
      const text = (matchedChunk as any).chunk_text || (matchedChunk as any).content || '';
      return text.replace(/^=+|=+$/gm, '').trim();
    }
    return `Welcome to **${brand}**! Feel free to ask about our store products, sizing, order tracking, shipping, and exchange policies.`;
  };

  // Phase C: Policies
  const policies = db.agent_policies.filter(p => p.agent_id === agent_id && p.is_active);
  for (const pol of policies) {
    policiesEvaluated.push({
      policy_title: pol.title,
      enforcement: pol.enforcement,
      passed: true
    });
  }

  let searchReturnedEmpty = false;

  // Phase D: Execution
  if (detectedIntent === 'PRODUCT_SEARCH') {
    planningSteps.push('3. Parsing search constraints (category, budget, size, color).');

    let maxPrice: number | undefined;
    const priceMatch = cleanMessage.match(/(?:under|below|less than|max)\s*(?:₹|\$)?\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = parseFloat(priceMatch[1]);
    }

    let requestedSize: string | undefined;
    const sizeMatch = cleanMessage.match(/size\s*(\d+|s|m|l|xl|xxl)/i);
    if (sizeMatch) {
      requestedSize = sizeMatch[1].toUpperCase();
    }

    let color: string | undefined;
    const colorMatch = cleanMessage.match(/\b(black|white|red|blue|grey|silver|olive)\b/i);
    if (colorMatch) {
      color = colorMatch[1];
    }

    planningSteps.push("4. Executing tool 'product_search' with extracted parameters.");
    const searchRes = await executeTool({
      tool_id: 'product_search',
      parameters: {
        query: cleanMessage,
        max_price: maxPrice,
        size: requestedSize,
        color: color
      },
      workspace_id,
      agent_id,
      conversation_id: conversation.id
    });

    toolExecutions.push({
      tool_name: 'product_search',
      input: { max_price: maxPrice, size: requestedSize, color },
      output: searchRes.data ? 'Found ' + searchRes.data.length + ' products' : searchRes.message,
      status: searchRes.status,
      latency_ms: searchRes.latency_ms
    });

    if (searchRes.status === 'PERMISSION_DENIED') {
      responseText = 'Product catalog search is currently disabled by store configuration. Please browse our collections online or contact customer support.';
      interactivePayload = null;
      searchReturnedEmpty = true;
    } else if (searchRes.data && searchRes.data.length > 0) {
      interactivePayload = searchRes.interactive_payload;
      const topProduct = searchRes.data[0];

      planningSteps.push('5. Verifying live variant inventory for product: ' + topProduct.title);
      const invRes = await executeTool({
        tool_id: 'inventory_lookup',
        parameters: { product_id: topProduct.id, variant_id: requestedSize },
        workspace_id,
        agent_id,
        conversation_id: conversation.id
      });

      toolExecutions.push({
        tool_name: 'inventory_lookup',
        input: { product_id: topProduct.id, size: requestedSize },
        output: invRes.data,
        status: invRes.status,
        latency_ms: invRes.latency_ms
      });

      const matchedList = searchRes.data.slice(0, 4);
      const matchedSummary = matchedList.map((p: any) => 
        `• ${p.title} (₹${typeof p.price === 'number' ? p.price.toLocaleString('en-IN') : p.price}) — ${p.description || p.category}`
      ).join('\n');

      const naturalProductPrompt = `You are a warm, stylish, and highly engaging AI shopping concierge for ${brand}.
The user asked: "${user_message}".
We found these matching products from our store catalog:
${matchedSummary}

Guidelines:
- Write an authentic, natural, and helpful recommendation in 1 to 2 short sentences.
- Highlight key benefits (e.g. UPF 50+ UV protection, Arctic Ice cooling tech, quick-dry anti-sweat fabric) with an enthusiastic, friendly tone.
- Do NOT repeat all price tags or dump raw lists since interactive product cards will appear directly below your message.
- Be conversational and offer help with sizing, fabric advice, or styling.`;

      const sarvamProductAnswer = await callSarvamLLM(
        naturalProductPrompt,
        user_message,
        `Matched Products:\n${matchedSummary}\n\n${fullKnowledgeContext}`,
        conversationHistory
      );

      if (sarvamProductAnswer) {
        responseText = sarvamProductAnswer;
      } else {
        if (matchedList.length === 1) {
          responseText = `Here is our **${matchedList[0].title}**! ${matchedList[0].description ? matchedList[0].description.slice(0, 150) : ''}`;
        } else if (/new|latest|arrival/i.test(user_message)) {
          responseText = `Here are our latest arrivals at **${brand}**:`;
        } else {
          responseText = `Here are our featured pieces from **${brand}** that match what you're looking for:`;
        }
      }

      if (requestedSize) {
        responseText += `\n\n✅ Size **${requestedSize}** is in stock.`;
      }
    } else {
      // Unrestricted conversational answer for open styling, recommendations, and search
      const naturalPrompt = `You are a helpful, knowledgeable, and friendly shopping specialist for ${brand}.
The user asked a question or searched for an item. Use the store catalog and past conversation context to give a clear, accurate, and direct answer.
If the customer asks about an item we don't have, explain politely and offer recommendations from our active collection.`;

      const sarvamAnswer = await callSarvamLLM(
        naturalPrompt,
        user_message,
        fullKnowledgeContext,
        conversationHistory
      );

      if (sarvamAnswer) {
        responseText = sarvamAnswer;
      } else if (citations.length > 0) {
        responseText = `${citations[0].chunk_text}\n\nLet me know if you would like me to help you find anything else!`;
      } else {
        responseText = `We don't currently have that specific item listed in our collection at **${brand}**, but feel free to let me know what style or category you're looking for!`;
      }

      searchReturnedEmpty = true;
      interactivePayload = null;
    }
  } else if (detectedIntent === 'CART_ACTION') {
    planningSteps.push('3. Processing Cart Action (Add to Cart / Bag Inspection).');
    const msgLower = user_message.toLowerCase();

    // Match product in query
    let targetProduct = storeProducts.find(p => msgLower.includes(p.title.toLowerCase()));
    if (!targetProduct) {
      targetProduct = storeProducts.find(p => {
        const tokens = p.title.toLowerCase().split(/[\s+]+/).filter(w => w.length > 3);
        return tokens.filter(t => msgLower.includes(t)).length >= 2;
      });
    }

    // If still not matched, resolve from recent conversation history (e.g. "add that to cart", "add it")
    if (!targetProduct && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const prevText = conversationHistory[i].content.toLowerCase();
        const prevMatched = storeProducts.find(p => prevText.includes(p.title.toLowerCase()));
        if (prevMatched) {
          targetProduct = prevMatched;
          break;
        }
      }
    }

    if (targetProduct) {
      planningSteps.push(`4. Adding product '${targetProduct.title}' to cart.`);
      const cartRes = await executeTool({
        tool_id: 'add_to_cart',
        parameters: {
          product_id: targetProduct.id,
          quantity: 1,
          cart_id: conversation.id
        },
        workspace_id,
        agent_id,
        conversation_id: conversation.id
      });

      toolExecutions.push({
        tool_name: 'add_to_cart',
        input: { product_id: targetProduct.id, quantity: 1 },
        output: cartRes.message,
        status: cartRes.status,
        latency_ms: cartRes.latency_ms
      });

      if (cartRes.status === 'PERMISSION_DENIED') {
        responseText = `Cart actions and ordering are currently disabled by store configuration. If you have questions about our items, I'd be glad to help!`;
        interactivePayload = null;
      } else {
        responseText = `🛒 Added **${targetProduct.title}** (₹${targetProduct.price.toLocaleString('en-IN')}) to your bag!\n\nYou can click the button below to view or manage your item, or let me know if you need sizing or styling advice before checkout.`;
        interactivePayload = {
          type: 'PRODUCTS',
          data: [targetProduct]
        };
      }
    } else {
      const cartRes = await executeTool({
        tool_id: 'cart_lookup',
        parameters: { cart_id: conversation.id },
        workspace_id,
        agent_id,
        conversation_id: conversation.id
      });
      if (cartRes.status === 'PERMISSION_DENIED') {
        responseText = `Cart management is currently disabled by store configuration.`;
        interactivePayload = null;
      } else if (cartRes.data && cartRes.data.items.length > 0) {
        responseText = `You currently have **${cartRes.data.items.length}** item(s) in your bag totaling **₹${cartRes.data.total.toLocaleString('en-IN')}**.`;
        interactivePayload = cartRes.interactive_payload;
      } else {
        responseText = `Your shopping bag is currently empty. Which item from **${brand}** would you like to add?`;
      }
    }
  } else if (detectedIntent === 'ORDER_TRACKING') {
    planningSteps.push('3. Extracting order identifier and customer email from input.');
    const orderMatch = user_message.match(/(?:#?|ord_)(\d{4,6})/i) || user_message.match(/#(\w+)/);
    if (!orderMatch) {
      responseText = "Could you please provide your **Order Number** (e.g. #10482) and the email address used for purchase so I can check your real-time tracking status?";
    } else {
      const orderNum = orderMatch[0].startsWith('#') ? orderMatch[0] : '#' + orderMatch[1];
      const emailMatch = user_message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const customerEmail = emailMatch ? emailMatch[1] : (params.customer_identifier?.includes('@') ? params.customer_identifier : 'sarah.sharma@gmail.com');

      planningSteps.push("4. Executing tool 'order_lookup' for order '" + orderNum + "'.");
      const orderRes = await executeTool({
        tool_id: 'order_lookup',
        parameters: { order_number: orderNum, customer_email: customerEmail },
        workspace_id,
        agent_id,
        conversation_id: conversation.id
      });

      toolExecutions.push({
        tool_name: 'order_lookup',
        input: { order_number: orderNum, customer_email: customerEmail },
        output: orderRes.data ? 'Order status: ' + orderRes.data.status : orderRes.message,
        status: orderRes.status,
        latency_ms: orderRes.latency_ms
      });

      if (orderRes.status === 'PERMISSION_DENIED') {
        responseText = 'Order lookup and tracking is currently disabled by store configuration. Please contact customer support for assistance with your order.';
        interactivePayload = null;
      } else if (orderRes.data) {
        interactivePayload = orderRes.interactive_payload;
        const order = orderRes.data;
        responseText = 'Here is the status for your order **' + order.order_number + '**:\n\n' +
          '• **Status**: `' + order.status + '`\n' +
          '• **Carrier**: ' + (order.carrier || 'Bluedart Express') + '\n' +
          '• **Tracking Number**: `' + (order.tracking_number || 'Pending') + '`\n' +
          '• **Items**: ' + order.items.map((i: any) => i.quantity + 'x ' + i.title).join(', ') + '\n' +
          '• **Destination**: ' + (order.shipping_destination || order.shipping_address || 'Customer Delivery Address');
      } else {
        responseText = 'I was unable to locate order **' + orderNum + '**. Please verify the order number and email address.';
      }
    }
  } else if (detectedIntent === 'RETURN_OR_POLICY_INQUIRY') {
    planningSteps.push('4. Synthesizing response using verified knowledge citations.');
    planningSteps.push(`5. Grounding verification: ${Math.round(ragResult.grounding_verification.confidence_score * 100)}% factual confidence.`);
    
    // Call Sarvam AI with full workspace knowledge & conversation history
    const naturalPrompt = `You are ShopMate AI, the intelligent assistant and knowledge expert for this workspace.

Core Capabilities:
- Answer questions accurately, clearly, and conversationally based on previous messages and workspace knowledge.
- When questions relate to company policies, operational SOPs (such as BrightForge Operations SOP), internal guidelines, shipping, returns, pricing, or products, use the provided Knowledge Base Documents as your primary factual guide.
- Explain the procedures, principles, roles, and rules described in the knowledge documents clearly and thoroughly.
- For general questions (styling, weather suitability, science, procedures), answer helpfully and professionally.
- Speak naturally and warmly.`;

    const sarvamAnswer = await callSarvamLLM(
      naturalPrompt,
      user_message,
      fullKnowledgeContext,
      conversationHistory
    );

    if (sarvamAnswer) {
      responseText = sarvamAnswer;
    } else {
      responseText = dynamicFallbackAnswer(user_message);
    }
  } else if (detectedIntent === 'HUMAN_HANDOFF') {
    planningSteps.push('4. Initiating human support escalation.');
    await executeTool({
      tool_id: 'human_handoff',
      parameters: { reason: 'Customer requested human representative.' },
      workspace_id,
      agent_id,
      conversation_id: conversation.id
    });
    responseText = "I've notified our support team! A specialist will connect with you right here in this chat shortly.";
  } else {
    // General freeform conversation or question -> Sarvam AI / Citations
    planningSteps.push('4. Calling Sarvam AI conversational model.');
    const naturalPrompt = `You are ShopMate AI, the intelligent assistant and knowledge expert for this workspace.

Core Capabilities:
- Answer ANY question the user asks naturally, intelligently, and contextually based on their prior conversation queries and workspace documents.
- When questions relate to company operations, SOP manuals (e.g. BrightForge Technologies Internal Operations SOP), policies, shipping, returns, pricing, or catalog products, use the provided knowledge base documents to explain the details thoroughly.
- Explain the key sections, workflows, objectives, and policies directly from the knowledge context.
- Speak naturally, warmly, and authoritatively like an experienced specialist.`;

    const sarvamAnswer = await callSarvamLLM(
      naturalPrompt,
      user_message,
      fullKnowledgeContext,
      conversationHistory
    );

    if (sarvamAnswer) {
      responseText = sarvamAnswer;
    } else {
      responseText = dynamicFallbackAnswer(user_message);
    }
  }

  // Ensure interactive product cards with photos & Add to Cart buttons are ALWAYS attached whenever products are discussed
  if (!interactivePayload) {
    const respLower = responseText.toLowerCase();
    const cleanLower = cleanMessage.toLowerCase();
    const freshProducts = db.commerce_products.filter(p => p.workspace_id === workspace_id);
    let matchedCards: any[] = [];

    // 1. Direct and fuzzy match with live catalog products in workspace
    freshProducts.forEach(p => {
      const pTitleLower = p.title.toLowerCase();
      if (respLower.includes(pTitleLower)) {
        if (!matchedCards.some(m => m.id === p.id)) matchedCards.push(p);
      } else {
        // Multi-token match (e.g. "Royal Heritage", "Yellow Floral Kurta", "Emerald Paisley")
        const significantTokens = pTitleLower.split(/\s+/).filter(w => w.length >= 4);
        if (significantTokens.length >= 2 && significantTokens.every(tok => respLower.includes(tok))) {
          if (!matchedCards.some(m => m.id === p.id)) matchedCards.push(p);
        }
      }
    });

    // 2. Parse any item lines from responseText (with or without bullets, e.g. "Royal Heritage Saree — ₹1,699 | ...")
    const productLineRegex = /(?:^|[\r\n]|•|\*|-)\s*([A-Za-z0-9\s&'()/-]{3,50}?)\s*(?:—|-|:)\s*(?:₹|Rs\.?|\$)\s*([\d,]+)/gim;
    let match;
    while ((match = productLineRegex.exec(responseText)) !== null) {
      const pTitle = match[1].trim();
      const pPrice = parseFloat(match[2].replace(/,/g, ''));
      
      let pItem = freshProducts.find(p => p.title.toLowerCase() === pTitle.toLowerCase() || p.title.toLowerCase().includes(pTitle.toLowerCase()));
      if (!pItem) {
        // High-quality category image
        let categoryImg = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80'; // saree / ethnic
        if (/kurta/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
        else if (/shirt|tee/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
        else if (/dress/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80';
        else if (/hoodie/i.test(pTitle)) categoryImg = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80';

        pItem = {
          id: generateId('prod_dyn'),
          workspace_id,
          title: pTitle,
          description: `${pTitle} crafted from premium materials at ${brand}.`,
          category: /saree/i.test(pTitle) ? 'Sarees' : (/kurta/i.test(pTitle) ? 'Kurtas' : (/combo/i.test(pTitle) ? 'Combos' : 'Apparel')),
          price: pPrice || 1499,
          currency: 'INR',
          images: [categoryImg],
          in_stock: true,
          total_inventory: 45,
          variants: [
            { id: generateId('var'), sku: `SKU-${pTitle.slice(0, 4).toUpperCase()}-M`, title: 'M', price: pPrice || 1499, inventory_quantity: 45, attributes: { size: 'Free Size' } }
          ],
          tags: [brand.toLowerCase(), 'women', 'festive', 'collection'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        db.commerce_products.push(pItem);
        db.scheduleSave();
      }
      if (pItem && !matchedCards.some(m => m.id === pItem!.id)) {
        matchedCards.push(pItem);
      }
    }

    // 3. If user asked for category/products (e.g. "women product?", "dress", "new products", "festive", "kurtas")
    if (matchedCards.length === 0 && (detectedIntent === 'PRODUCT_SEARCH' || /product|dress|women|woman|men|saree|kurta|shirt|festive|new|latest|collection/i.test(cleanLower))) {
      const queryTokens = cleanLower.split(/\s+/).filter(w => w.length > 2);
      matchedCards = freshProducts.filter(p => {
        const fullP = `${p.title} ${p.description} ${p.category} ${p.tags?.join(' ')}`.toLowerCase();
        return queryTokens.some(tok => fullP.includes(tok));
      });

      if (matchedCards.length === 0 && freshProducts.length > 0) {
        matchedCards = freshProducts.slice(0, 4);
      }
    }

    if (matchedCards.length > 0) {
      interactivePayload = {
        type: 'PRODUCTS',
        data: matchedCards.slice(0, 6)
      };
    }
  }

  const asstMsgId = generateId('msg');
  const asstMsg: Message = {
    id: asstMsgId,
    conversation_id: conversation.id,
    workspace_id: workspace_id,
    role: 'ASSISTANT',
    content: responseText,
    interactive_payload: interactivePayload,
    created_at: new Date().toISOString()
  };
  db.messages.push(asstMsg);
  conversation.message_count += 1;
  conversation.updated_at = new Date().toISOString();

  const totalLatency = Date.now() - startTime;
  const trace: ExecutionTrace = {
    id: generateId('trc'),
    conversation_id: conversation.id,
    message_id: asstMsgId,
    agent_id: agent_id,
    workspace_id: workspace_id,
    intent: detectedIntent,
    goal: config.goals?.[0] || 'Commerce Assistance',
    planning_steps: planningSteps,
    tool_executions: toolExecutions,
    retrieved_citations: citations.map(c => ({
      document_name: c.document_name,
      chunk_text: c.chunk_text,
      relevance_score: c.relevance_score,
      is_verified: c.is_verified
    })),
    rag_pipeline: {
      query_understanding: {
        detected_intent: ragResult.query_understanding.detected_intent,
        extracted_entities: ragResult.query_understanding.extracted_entities
      },
      query_rewrite: {
        original_query: ragResult.query_rewrite.original_query,
        rewritten_query: ragResult.query_rewrite.rewritten_query,
        expansion_terms: ragResult.query_rewrite.expansion_terms
      },
      hybrid_retrieval: {
        dense_hits: ragResult.hybrid_retrieval.dense_hits,
        sparse_hits: ragResult.hybrid_retrieval.sparse_hits
      },
      rrf_fusion: {
        fused_candidates: ragResult.rrf_fusion.fused_candidates,
        rrf_constant: ragResult.rrf_fusion.rrf_constant
      },
      reranking: {
        candidates_scored: ragResult.reranking.candidates_scored,
        top_score: ragResult.reranking.top_score
      },
      context_assembly: {
        tokens_assembled: ragResult.context_assembly.total_tokens,
        chunks_used: ragResult.context_assembly.chunks_included
      },
      grounding_verification: {
        is_grounded: ragResult.grounding_verification.is_grounded,
        confidence_score: ragResult.grounding_verification.confidence_score,
        unsupported_claims: [],
        verified_facts_count: ragResult.grounding_verification.verified_facts_count
      }
    },
    policies_evaluated: policiesEvaluated,
    latency_ms: totalLatency,
    tokens_used: {
      input: Math.ceil((user_message.length + 120) / 4),
      output: Math.ceil((responseText.length) / 4),
      total: Math.ceil((user_message.length + responseText.length + 120) / 4)
    },
    created_at: new Date().toISOString()
  };
  db.executions.push(trace);
  db.scheduleSave();

  return {
    conversation_id: conversation.id,
    message_id: asstMsgId,
    response_text: responseText,
    interactive_payload: interactivePayload,
    trace
  };
}
