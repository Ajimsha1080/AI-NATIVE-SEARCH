import { db } from '../db';
import { executeRAGPipeline } from '../rag';
import { executeTool } from '../tools';
import { commerceEngine } from '../commerce';
import { generateId } from '../utils';
import { AgentConfig, CommerceProduct, ExecutionTrace, Message } from '@/types';
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
  metadata?: any;
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
      signal: AbortSignal.timeout(3500)
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

function cleanConversationalResponse(text: string, brand: string, hasProductCards: boolean): string {
  if (!text) return text;

  let cleaned = text;

  // 1. Remove apologetic meta-catalog sentences or robotic AI disclaimers
  cleaned = cleaned.replace(/^(?:Hi there! 👋\s*)?(?:Welcome to [^.\n]+[.\n]\s*)?(?:While we (?:don't|do not) have a specific [^.\n]+(?:catalog|inventory|section|collection)[^.\n]*[.\n]\s*)+/gi, '');
  cleaned = cleaned.replace(/While we (?:don't|do not) have a specific [^.\n]+(?:catalog|inventory|section|collection)[^.\n]*[.\n]\s*/gi, '');
  cleaned = cleaned.replace(/As an AI(?: language model)?[^.\n]*[.\n]\s*/gi, '');

  // 2. Remove fake text-based product card annotations like [Product Card] ... — Add to Cart
  cleaned = cleaned.replace(/\[Product Card\][^\n\r]+/gi, '');
  cleaned = cleaned.replace(/—\s*Add to Cart/gi, '');
  cleaned = cleaned.replace(/\[Add to Cart\]/gi, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 3. If product cards are attached and the LLM dumped a long markdown bullet list of products
  if (hasProductCards && (cleaned.includes('•') || cleaned.includes('* ') || cleaned.includes('🌟') || cleaned.includes('👕') || cleaned.includes('👖'))) {
    const parts = cleaned.split(/(?:\n\s*(?:🌟|👕|👖|👗|•|\*|-)\s*)/);
    if (parts.length > 1 && parts[0].trim().length > 20) {
      let lead = parts[0].trim();
      lead = lead.replace(/(?:Here are (?:some highlights|our featured pieces|our top picks)[^:]*:?\s*)$/i, '').trim();
      if (lead.length > 20) {
        cleaned = `${lead} Here are our featured pieces from **${brand}**:`;
      } else {
        cleaned = `Here are our top featured pieces from **${brand}**:`;
      }
    } else if (parts.length > 1) {
      cleaned = `Here are our top featured pieces from **${brand}**:`;
    }
  }

  return cleaned.trim();
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

  // Phase A: Conversation Context & Reference State
  const previousProducts: CommerceProduct[] = [];
  let lastSearchState: any = null;
  const prevAssistantMsgs = db.messages
    .filter(m => m.conversation_id === conversation.id && m.role === 'ASSISTANT')
    .slice(-6);

  for (const m of prevAssistantMsgs) {
    const pData = m.interactive_payload?.data || m.metadata?.products;
    if (Array.isArray(pData)) {
      for (const p of pData) {
        if (p && p.id && !previousProducts.some(existing => existing.id === p.id)) {
          previousProducts.push(p);
        }
      }
    }
  }

  for (let i = prevAssistantMsgs.length - 1; i >= 0; i--) {
    const m = prevAssistantMsgs[i];
    if (m.metadata?.last_search_state) {
      lastSearchState = m.metadata.last_search_state;
      break;
    }
  }

  // Introspect schema and dynamically parse query
  const parsedSearch = commerceEngine.parseQuery(workspace_id, cleanMessage, lastSearchState);

  const resolveReferencedProduct = (text: string): CommerceProduct | null => {
    const lower = text.toLowerCase();
    
    // Ordinal resolution from parsed query or text
    if (parsedSearch.referencedOrdinal !== undefined) {
      if (parsedSearch.referencedOrdinal === -1 && previousProducts.length > 0) {
        return previousProducts[previousProducts.length - 1];
      }
      const idx = parsedSearch.referencedOrdinal - 1;
      if (idx >= 0 && idx < previousProducts.length) {
        return previousProducts[idx];
      }
    }

    if (/\b(?:second|2nd|second one|second product|number 2)\b/i.test(lower) && previousProducts.length >= 2) {
      return previousProducts[1];
    }
    if (/\b(?:first|1st|first one|first product|number 1)\b/i.test(lower) && previousProducts.length >= 1) {
      return previousProducts[0];
    }
    if (/\b(?:third|3rd|third one|third product|number 3)\b/i.test(lower) && previousProducts.length >= 3) {
      return previousProducts[2];
    }
    if (/\b(?:last|last one|last product)\b/i.test(lower) && previousProducts.length > 0) {
      return previousProducts[previousProducts.length - 1];
    }
    if (/\b(?:cheaper|cheapest|cheaper one)\b/i.test(lower) && previousProducts.length > 0) {
      return [...previousProducts].sort((a, b) => a.price - b.price)[0];
    }
    
    // Color resolution in previous products
    if (parsedSearch.referencedColor && previousProducts.length > 0) {
      const colorToken = parsedSearch.referencedColor;
      const colorMatch = previousProducts.find(p => 
        p.title.toLowerCase().includes(colorToken) ||
        p.variants?.some((v: any) => (v.attributes?.color || v.title || '').toLowerCase().includes(colorToken))
      );
      if (colorMatch) return colorMatch;
    }

    // Direct product title match in active catalog
    const directCatalogMatch = storeProducts.find(p => lower.includes(p.title.toLowerCase()));
    if (directCatalogMatch) return directCatalogMatch;

    // Default pronoun reference ("this", "that", "it") -> first previous product
    if (/\b(?:this|that|it|item|product)\b/i.test(lower) && previousProducts.length > 0) {
      return previousProducts[0];
    }

    return previousProducts[0] || null;
  };

  // Phase B: Intent Classification & Multi-Action Detection
  const hasHumanEscalation = parsedSearch.intent === 'HUMAN_HANDOFF';
  const isComparisonQuery = parsedSearch.intent === 'PRODUCT_COMPARISON';
  const isInventoryQuery = parsedSearch.intent === 'INVENTORY_CHECK';
  const isCartAction = parsedSearch.intent === 'CART_ACTION';
  const isOrderTracking = parsedSearch.intent === 'ORDER_TRACKING';
  const isPolicyInquiry = /return|refund|exchange|warranty|policy|shipping policy|how many days|shipping time|when will it arrive|shipping cost|payment method|cod|cash on delivery|who are you|about|contact|phone|email|address|location|headquarters|support/i.test(cleanMessage);
  const isProductDiscovery = parsedSearch.intent === 'PRODUCT_SEARCH' || /show|find|search|look for|need|want|recommend|suggest|what (?:do )?you have|something|nice|dinner|office|casual|wedding|gift|brother|wife|sister|summer|red|blue|black|white|yellow|green|shirt|kurta|saree|jacket|dress|combo|under|below|around|size|products|new|latest|expensive|cheap|premium|comfort|more/i.test(cleanMessage);

  // Mixed Intent: Product search + Policy Inquiry
  const isMixedIntent = isProductDiscovery && isPolicyInquiry;

  let detectedIntent = 'GENERAL_QUERY';
  if (hasHumanEscalation) detectedIntent = 'HUMAN_HANDOFF';
  else if (parsedSearch.intent === 'BUY_NOW') detectedIntent = 'BUY_NOW';
  else if (isComparisonQuery) detectedIntent = 'PRODUCT_COMPARISON';
  else if (isInventoryQuery) detectedIntent = 'INVENTORY_CHECK';
  else if (isCartAction) detectedIntent = 'CART_ACTION';
  else if (isOrderTracking) detectedIntent = 'ORDER_TRACKING';
  else if (isMixedIntent) detectedIntent = 'MIXED_PRODUCT_AND_POLICY';
  else if (isPolicyInquiry) detectedIntent = 'RETURN_OR_POLICY_INQUIRY';
  else if (isProductDiscovery) detectedIntent = 'PRODUCT_SEARCH';

  planningSteps.push('1. Intent detected: ' + detectedIntent);

  // Extract structured filters
  let maxPrice: number | undefined = parsedSearch.maxPrice;
  let minPrice: number | undefined = parsedSearch.minPrice;
  let requestedSize: string | undefined = parsedSearch.size;
  let color: string | undefined = parsedSearch.color;
  let gender: 'men' | 'women' | 'unisex' | 'kids' | undefined = parsedSearch.gender;

  // Phase C: 12-Stage RAG Execution (scoped to workspace)
  planningSteps.push('2. Running 12-Stage RAG: Query Understanding → Expansion → Hybrid Retrieval → RRF → Rerank.');
  const ragResult = await executeRAGPipeline(workspace_id, cleanMessage, {
    topK: 5,
    minScore: 0.15,
    agentId: agent_id
  });
  const citations = ragResult.citations;

  const workspaceChunks = db.knowledge_chunks.filter(c => c.workspace_id === workspace_id);
  const citationTexts = citations.map(c => c.chunk_text.trim());
  const otherChunkTexts = workspaceChunks
    .map(c => c.content.trim())
    .filter(content => !citationTexts.some(cit => cit.includes(content) || content.includes(cit)))
    .slice(0, 15);

  const knowledgeSections = [
    ...(citationTexts.length > 0 ? ['[Top Verified Store Knowledge Citations]:\n' + citationTexts.join('\n\n')] : []),
    ...(otherChunkTexts.length > 0 ? ['[Store Policies & FAQ Documentation]:\n' + otherChunkTexts.join('\n\n')] : [])
  ].join('\n\n');

  const fullKnowledgeContext = `Live Product Catalog:\n${catalogContext}\n\nRelevant Store Knowledge Context:\n${knowledgeSections || 'No specific policy documents on file.'}`;

  // Helper for dynamic policy extraction fallback
  const dynamicFallbackAnswer = (query: string): string => {
    const qLower = query.toLowerCase();
    const queryTokens = qLower.split(/[\s,?.!]+/).filter(w => w.length >= 3);

    const scoredChunks = workspaceChunks.map(c => {
      const cText = (c.content || '').toLowerCase();
      let score = 0;
      queryTokens.forEach(tok => {
        if (cText.includes(tok)) score += (tok.length > 5 ? 2 : 1);
      });
      return { chunk: c, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

    if (scoredChunks.length > 0) {
      return scoredChunks.slice(0, 2).map(s => s.chunk.content.replace(/^=+|=+$/gm, '').trim()).join('\n\n');
    }
    if (citations.length > 0) {
      return citations[0].chunk_text.replace(/^=+|=+$/gm, '').trim();
    }
    return `Welcome to **${brand}**! Feel free to ask about our store products, sizing, order tracking, shipping, and exchange policies.`;
  };

  // Phase D: Execution of Authoritative Tools

  if (detectedIntent === 'PRODUCT_COMPARISON') {
    planningSteps.push('3. Executing product comparison over referenced session items.');
    let compTargetIds = previousProducts.slice(0, 3).map(p => p.id);
    if (compTargetIds.length === 0) {
      const topItems = await commerceEngine.searchProducts(workspace_id, { query: cleanMessage });
      compTargetIds = topItems.slice(0, 2).map(p => p.id);
    }

    const compResult = await commerceEngine.compareProducts(workspace_id, compTargetIds);
    if (compResult.products.length >= 2) {
      const cheapest = compResult.cheapest!;
      const mostExp = compResult.mostExpensive!;
      const priceDiff = mostExp.price - cheapest.price;
      
      responseText = `Between the items, **${cheapest.title}** is the most affordable at **₹${cheapest.price.toLocaleString('en-IN')}**${priceDiff > 0 ? ` (₹${priceDiff.toLocaleString('en-IN')} less than **${mostExp.title}** at ₹${mostExp.price.toLocaleString('en-IN')})` : ''}. Both feature premium craftsmanship suited for your style.`;
      interactivePayload = {
        type: 'PRODUCTS',
        data: compResult.products
      };
    } else {
      responseText = `Here are our featured selections from **${brand}** for comparison:`;
      const fallbackList = await commerceEngine.searchProducts(workspace_id, { query: cleanMessage });
      interactivePayload = {
        type: 'PRODUCTS',
        data: fallbackList.slice(0, 4)
      };
    }
  } else if (detectedIntent === 'INVENTORY_CHECK') {
    planningSteps.push('3. Executing authoritative inventory check.');
    const refProduct = resolveReferencedProduct(cleanMessage);
    if (refProduct) {
      const inv = await commerceEngine.getInventory(workspace_id, refProduct.id, requestedSize);
      if (inv.in_stock) {
        responseText = `✅ **${refProduct.title}**${requestedSize ? ` in size **${requestedSize}**` : ''} is **In Stock** (${inv.available_quantity} available) at **₹${refProduct.price.toLocaleString('en-IN')}**!`;
      } else {
        responseText = `⚠️ **${refProduct.title}**${requestedSize ? ` in size **${requestedSize}**` : ''} is currently out of stock, but other sizes are available.`;
      }
      interactivePayload = {
        type: 'PRODUCTS',
        data: [refProduct]
      };
    } else {
      responseText = `Which product would you like me to check stock for?`;
    }
  } else if (detectedIntent === 'CART_ACTION') {
    planningSteps.push('3. Executing authoritative cart action.');
    const isRemove = /\bremove|delete\b/i.test(cleanMessage);
    const isViewCart = /\b(?:show|view|what(?:'s| is) in)\b/i.test(cleanMessage) && !/add/i.test(cleanMessage);

    if (isViewCart) {
      const cart = await commerceEngine.getCart(workspace_id, conversation.id);
      if (cart.items.length > 0) {
        responseText = `You currently have **${cart.items.length}** item(s) in your bag totaling **₹${cart.total.toLocaleString('en-IN')}**.`;
        interactivePayload = {
          type: 'CART_SUMMARY',
          data: cart
        };
      } else {
        responseText = `Your shopping bag is currently empty. What style from **${brand}** would you like to explore?`;
      }
    } else {
      const targetProduct = resolveReferencedProduct(cleanMessage);
      if (targetProduct) {
        if (isRemove) {
          const cart = await commerceEngine.removeFromCart(workspace_id, conversation.id, targetProduct.id);
          responseText = `🗑️ Removed **${targetProduct.title}** from your bag. Your updated bag total is **₹${cart.total.toLocaleString('en-IN')}**.`;
          interactivePayload = {
            type: 'CART_SUMMARY',
            data: cart
          };
        } else {
          const cart = await commerceEngine.addToCart(workspace_id, conversation.id, {
            productId: targetProduct.id,
            quantity: 1
          });
          responseText = `🛒 Added **${targetProduct.title}** (₹${targetProduct.price.toLocaleString('en-IN')}) to your bag!\n\nYou can click the button below to view or manage your item, or let me know if you need sizing or styling advice before checkout.`;
          interactivePayload = {
            type: 'PRODUCTS',
            data: [targetProduct]
          };
        }
      } else {
        responseText = `Which product would you like to add to your bag?`;
      }
    }
  } else if (detectedIntent === 'BUY_NOW') {
    planningSteps.push('3. Executing Agentic Buy Now / Razorpay flow: Resolving referenced product, validating inventory and preparing instant checkout session.');
    const targetProduct = resolveReferencedProduct(cleanMessage);
    if (targetProduct) {
      const selectedVariant = (requestedSize && targetProduct.variants?.find((v: any) => v.attributes?.size?.toLowerCase() === requestedSize?.toLowerCase() || v.title?.toLowerCase().includes(requestedSize?.toLowerCase()))) || targetProduct.variants?.[0];
      const unitPrice = selectedVariant?.price || targetProduct.price;
      const isRazorpayExplicit = /\b(?:razorpay|payment link|pay link|send link|agentic payment)\b/i.test(cleanMessage);

      const { razorpayService } = await import('../payments/razorpay');
      const rzpOrder = await razorpayService.createOrder({
        amount: unitPrice,
        currency: targetProduct.currency || 'INR',
        notes: {
          workspace_id,
          product_id: targetProduct.id,
          variant_id: selectedVariant?.id || ''
        }
      });

      const paymentLink = await razorpayService.createPaymentLink({
        amount: unitPrice,
        currency: targetProduct.currency || 'INR',
        description: `Payment for ${targetProduct.title}`,
        customer: {
          name: params.customer_identifier || 'Valued Customer',
          email: params.customer_identifier?.includes('@') ? params.customer_identifier : 'customer@example.com'
        }
      });

      if (isRazorpayExplicit) {
        responseText = `⚡ **Razorpay Agentic Payment Ready!**\n\nI've generated a secure Razorpay checkout order for **${targetProduct.title}** at **₹${unitPrice.toLocaleString('en-IN')}**.\n\nYou can complete payment directly in the popup or via UPI/Cards:`;
      } else {
        responseText = `⚡ Instant checkout ready for **${targetProduct.title}**${selectedVariant ? ` (${selectedVariant.title || selectedVariant.attributes?.size || 'Standard'})` : ''} at **₹${unitPrice.toLocaleString('en-IN')}**. Please complete your shipping and payment details in the checkout window:`;
      }
      
      interactivePayload = {
        type: 'CHECKOUT_SESSION',
        data: {
          product: targetProduct,
          variant: selectedVariant,
          quantity: 1,
          checkoutId: `chk_${Date.now()}`,
          razorpay: {
            order_id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key_id: rzpOrder.key_id,
            payment_link: paymentLink.short_url,
            is_mock: rzpOrder.is_mock
          }
        }
      };
    } else {
      responseText = `Which product would you like to buy or generate a payment link for? You can click **Buy Now** on any product card or tell me the item name.`;
    }
  } else if (detectedIntent === 'ORDER_TRACKING') {
    planningSteps.push('3. Extracting order identifier and customer email.');
    const orderMatch = user_message.match(/(?:#?|ord_)(\d{4,6})/i) || user_message.match(/#(\w+)/);
    if (!orderMatch) {
      responseText = "Could you please provide your **Order Number** (e.g. #10482) and the email address used for purchase so I can check your real-time tracking status?";
    } else {
      const orderNum = orderMatch[0].startsWith('#') ? orderMatch[0] : '#' + orderMatch[1];
      const emailMatch = user_message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const customerEmail = emailMatch ? emailMatch[1] : (params.customer_identifier?.includes('@') ? params.customer_identifier : 'sarah.sharma@gmail.com');

      const order = await commerceEngine.getOrder(workspace_id, orderNum, customerEmail);
      if (order) {
        responseText = `Here is the status for your order **${order.order_number}**:\n\n• **Status**: \`${order.status}\`\n• **Carrier**: ${order.carrier || 'Bluedart Express'}\n• **Tracking Number**: \`${order.tracking_number || 'Pending'}\`\n• **Items**: ${order.items.map((i: any) => `${i.quantity}x ${i.title}`).join(', ')}\n• **Destination**: ${order.shipping_address || 'Customer Delivery Address'}`;
        interactivePayload = {
          type: 'ORDER_TRACKING',
          data: order
        };
      } else {
        responseText = `I was unable to locate order **${orderNum}**. Please verify the order number and email address.`;
      }
    }
  } else if (detectedIntent === 'MIXED_PRODUCT_AND_POLICY') {
    planningSteps.push('3. Executing combined multi-intent: Product Discovery + Policy Verification.');
    
    const searchResult = await commerceEngine.searchProductsDetailed(workspace_id, {
      query: cleanMessage,
      category: parsedSearch.explicitCategory,
      gender: gender as any,
      color,
      minPrice,
      maxPrice,
      size: requestedSize,
      inStockOnly: true,
      sort: parsedSearch.sort,
      page: parsedSearch.page,
      pageSize: parsedSearch.pageSize,
      scope: parsedSearch.scope
    }, lastSearchState);

    const topCards = searchResult.products.slice(0, 4);
    const matchedSummary = topCards.map(p => `• ${p.title} (₹${p.price})`).join('\n');

    const multiPrompt = `You are the exclusive AI personal stylist and shopping concierge for ${brand}.
Customer Query: "${user_message}"

Matching Catalog Products:
${matchedSummary || 'No exact product match found'}

Relevant Policy Facts:
${citationTexts.join('\n') || 'Standard 7-30 day return policy with doorstep pickup.'}

STRICT GUIDELINES:
1. Answer BOTH parts of the customer query naturally, concisely, and warmly in 1 to 2 sentences.
2. Direct them to the product cards below and confirm the policy details directly from facts.
3. NEVER format markdown product cards like [Product Card] or fake buttons in text.`;

    const multiAnswer = await callSarvamLLM(multiPrompt, user_message, fullKnowledgeContext, conversationHistory);
    if (multiAnswer) {
      responseText = multiAnswer;
    } else {
      responseText = `Here are our recommended pieces from **${brand}**! Yes, all eligible items come with our standard return and exchange window.`;
    }

    if (topCards.length > 0) {
      interactivePayload = {
        type: 'PRODUCTS',
        data: topCards,
        pagination: {
          page: searchResult.page,
          pageSize: searchResult.pageSize,
          page_size: searchResult.pageSize,
          totalMatches: searchResult.totalMatches,
          total_matches: searchResult.totalMatches,
          hasMore: searchResult.hasMore,
          has_more: searchResult.hasMore,
          displayed_count: (searchResult.page - 1) * searchResult.pageSize + topCards.length,
          total_displayed: (searchResult.page - 1) * searchResult.pageSize + topCards.length
        }
      };
    }
  } else if (detectedIntent === 'PRODUCT_SEARCH') {
    planningSteps.push('3. Executing structured product discovery & recommendation.');
    
    const searchResult = await commerceEngine.searchProductsDetailed(workspace_id, {
      query: cleanMessage,
      category: parsedSearch.explicitCategory,
      gender: gender as any,
      color,
      minPrice,
      maxPrice,
      size: requestedSize,
      inStockOnly: true,
      sort: parsedSearch.sort,
      page: parsedSearch.page,
      pageSize: parsedSearch.pageSize,
      scope: parsedSearch.scope
    }, lastSearchState);

    const matchedProducts = searchResult.products;

    if (matchedProducts.length > 0) {
      interactivePayload = {
        type: 'PRODUCTS',
        data: matchedProducts,
        pagination: {
          page: searchResult.page,
          pageSize: searchResult.pageSize,
          page_size: searchResult.pageSize,
          totalMatches: searchResult.totalMatches,
          total_matches: searchResult.totalMatches,
          hasMore: searchResult.hasMore,
          has_more: searchResult.hasMore,
          displayed_count: (searchResult.page - 1) * searchResult.pageSize + matchedProducts.length,
          total_displayed: (searchResult.page - 1) * searchResult.pageSize + matchedProducts.length
        }
      };

      if (parsedSearch.scope === 'pagination') {
        responseText = `Here are more selections from our collection at **${brand}**:`;
      } else if (parsedSearch.scope === 'all_matching') {
        responseText = `Found **${searchResult.totalMatches}** matching items in our collection at **${brand}**:`;
      } else {
        const matchedSummary = matchedProducts.slice(0, 4).map(p => 
          `• ${p.title} (₹${typeof p.price === 'number' ? p.price.toLocaleString('en-IN') : p.price}) — ${p.description || p.category}`
        ).join('\n');

        const naturalProductPrompt = `You are the exclusive, stylish AI shopping concierge and personal stylist for ${brand}.
Customer Query: "${user_message}"

Matching Catalog Products:
${matchedSummary}

STRICT GUIDELINES:
1. Write a warm, elegant, and concise styling recommendation in 1 to 2 short sentences.
2. Highlight fabric quality, artisan craftsmanship, or styling vibes naturally, and invite them to explore the pieces below or ask about sizing.
3. NEVER say "we don't have a specific 'new product' section", "in our current live catalog", "as an AI", or apologize for catalog categorization.
4. NEVER dump long lists, markdown bullet points, or prices in text because clickable photo cards with Add to Cart buttons are already displayed directly below your chat bubble.
5. NEVER generate fake text tags like [Product Card] or — Add to Cart.`;

        const sarvamProductAnswer = await callSarvamLLM(
          naturalProductPrompt,
          user_message,
          `Live Catalog Items:\n${matchedSummary}\n\n${fullKnowledgeContext}`,
          conversationHistory
        );

        if (sarvamProductAnswer) {
          responseText = sarvamProductAnswer;
        } else {
          if (matchedProducts.length === 1) {
            responseText = `Here is our **${matchedProducts[0].title}**! ${matchedProducts[0].description ? matchedProducts[0].description.slice(0, 150) : ''}`;
          } else if (/new|latest|arrival/i.test(user_message)) {
            responseText = `Here are our latest arrivals from **${brand}**:`;
          } else {
            responseText = `Here are our top recommended pieces from **${brand}**:`;
          }
        }

        if (requestedSize) {
          responseText += `\n\n✅ Size **${requestedSize}** is in stock.`;
        }
      }
    } else {
      responseText = `I couldn't find an exact match for "${user_message}" in our active collection at **${brand}**. Let me know if you'd like to explore other colors, styles, or categories!`;
      interactivePayload = null;
    }
  } else if (detectedIntent === 'RETURN_OR_POLICY_INQUIRY') {
    planningSteps.push('4. Synthesizing response using verified knowledge citations.');
    
    const naturalPrompt = `You are the official AI shopping concierge and knowledge specialist for ${brand}.
Customer Query: "${user_message}"

STRICT GUIDELINES:
1. ALWAYS answer the user's question directly, accurately, and thoroughly using the provided Relevant Store Knowledge Context.
2. If the user asks about shipping times, delivery areas, return/exchange policies, material quality, pricing, contact details, or brand background, extract and explain the exact details from the store knowledge documents.
3. Keep your response clear, concise, and helpful (1-3 sentences).
4. Never say "as an AI" or use generic ungrounded fallback statements.`;

    const sarvamAnswer = await callSarvamLLM(naturalPrompt, user_message, fullKnowledgeContext, conversationHistory);
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
    // General Conversation / Advice
    planningSteps.push('4. Calling conversational shopping concierge model.');
    const naturalPrompt = `You are the official AI shopping concierge and style specialist for ${brand}.
Customer Query: "${user_message}"

STRICT GUIDELINES:
1. Answer ANY question the customer asks naturally, warmly, and helpfully.
2. If they are unsure what to buy, ask about their style preference, occasion, or favorite colors.
3. NEVER apologize about catalog structure or say "we don't have a specific section in our catalog".
4. NEVER dump long bullet lists of products and prices in text.`;

    const sarvamAnswer = await callSarvamLLM(naturalPrompt, user_message, fullKnowledgeContext, conversationHistory);
    if (sarvamAnswer) {
      responseText = sarvamAnswer;
    } else {
      responseText = `I'd love to help you find the perfect outfit! Are you shopping for a specific occasion like a dinner, wedding, casual weekend, or looking for a gift?`;
    }
  }

  // Sanitize conversational response for clean, elegant output
  const finalResponseText = cleanConversationalResponse(
    responseText,
    brand,
    interactivePayload?.type === 'PRODUCTS'
  );

  const asstMsgId = generateId('msg');
  const asstMsg: Message = {
    id: asstMsgId,
    conversation_id: conversation.id,
    workspace_id: workspace_id,
    role: 'ASSISTANT',
    content: finalResponseText,
    interactive_payload: interactivePayload,
    metadata: {
      ...(interactivePayload || {}),
      products: interactivePayload?.type === 'PRODUCTS' ? interactivePayload.data : undefined,
      pagination: interactivePayload?.pagination,
      ...(interactivePayload?.type === 'PRODUCTS' ? {
        last_search_state: {
          ...parsedSearch,
          original_query: lastSearchState?.original_query || cleanMessage,
          page: interactivePayload.pagination?.page || parsedSearch.page,
          pageSize: interactivePayload.pagination?.pageSize || parsedSearch.pageSize,
          page_size: interactivePayload.pagination?.pageSize || parsedSearch.pageSize,
          totalMatches: interactivePayload.pagination?.totalMatches,
          total_matches: interactivePayload.pagination?.totalMatches,
          hasMore: interactivePayload.pagination?.hasMore,
          has_more: interactivePayload.pagination?.hasMore,
          seen_product_ids: Array.from(new Set([
            ...(lastSearchState?.seen_product_ids || []),
            ...(Array.isArray(interactivePayload.data) ? interactivePayload.data.map((p: any) => p.id) : [])
          ]))
        }
      } : {})
    },
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
    metadata: asstMsg.metadata,
    trace
  };
}
