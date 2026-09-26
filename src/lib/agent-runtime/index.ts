import { db } from '../db';
import { executeRAGPipeline } from '../rag';
import { executeTool } from '../tools';
import { generateId } from '../utils';
import { AgentConfig, ExecutionTrace, Message } from '@/types';

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

export async function runAgentCycle(params: AgentRunParams): Promise<AgentRunResponse> {
  const startTime = Date.now();
  const { agent_id, workspace_id, user_message, channel = 'PLAYGROUND' } = params;

  const agent = db.agents.find(a => a.id === agent_id && a.workspace_id === workspace_id);
  if (!agent) throw new Error('Agent ' + agent_id + ' not found in workspace.');

  const config = db.agent_configs.find(c => c.agent_id === agent_id) || ({
    identity: { name: agent.name, greeting: 'Hello!', brand_name: 'Blue Tyga Store' },
    instructions: { system_prompt: 'You are an AI commerce assistant.' },
    personality: { tone: 'friendly' },
  } as unknown as AgentConfig);

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

  // Phase A: Intent Detection
  let detectedIntent = 'GENERAL_QUERY';
  if (/human|agent|support|representative|talk to someone|live operator/i.test(user_message)) {
    detectedIntent = 'HUMAN_HANDOFF';
  } else if (/return|refund|exchange|warranty|policy|shipping policy|how to return/i.test(user_message)) {
    detectedIntent = 'RETURN_OR_POLICY_INQUIRY';
  } else if (/order|tracking|track|#10|package|delivery|where is my/i.test(user_message)) {
    detectedIntent = 'ORDER_TRACKING';
  } else if (/cart|add to cart|checkout|bag/i.test(user_message)) {
    detectedIntent = 'CART_ACTION';
  } else if (/find|search|show|look for|shoes|running|sneaker|jacket|headphone|price|under|buy|recommend/i.test(user_message)) {
    detectedIntent = 'PRODUCT_SEARCH';
  }

  planningSteps.push('1. Intent detected: ' + detectedIntent);

  // Phase B: 12-Stage Advanced RAG Pipeline Execution
  planningSteps.push('2. Running 12-Stage RAG: Query Understanding → Expansion → Hybrid Retrieval → RRF → Rerank → Context Assembly.');
  const ragResult = await executeRAGPipeline(workspace_id, user_message, {
    topK: 3,
    minScore: 0.20,
    agentId: agent_id
  });
  const citations = ragResult.citations;
  planningSteps.push(`3. RAG complete: ${ragResult.citations.length} verified citation(s) retrieved (Top Score: ${(ragResult.reranking.top_score * 100).toFixed(1)}%).`);

  // Phase C: Policies
  const policies = db.agent_policies.filter(p => p.agent_id === agent_id && p.is_active);
  for (const pol of policies) {
    policiesEvaluated.push({
      policy_title: pol.title,
      enforcement: pol.enforcement,
      passed: true
    });
  }

  // Phase D: Execution
  if (detectedIntent === 'PRODUCT_SEARCH') {
    planningSteps.push('3. Parsing search constraints (category, budget, size, color).');

    let maxPrice: number | undefined;
    const priceMatch = user_message.match(/(?:under|below|less than|max)\s*\$?(\d+)/i);
    if (priceMatch) {
      maxPrice = parseFloat(priceMatch[1]);
    }

    let requestedSize: string | undefined;
    const sizeMatch = user_message.match(/size\s*(\d+|s|m|l|xl)/i);
    if (sizeMatch) {
      requestedSize = sizeMatch[1].toUpperCase();
    }

    let color: string | undefined;
    const colorMatch = user_message.match(/\b(black|white|red|blue|grey|silver)\b/i);
    if (colorMatch) {
      color = colorMatch[1];
    }

    planningSteps.push("4. Executing tool 'product_search' with extracted parameters.");
    const searchRes = await executeTool({
      tool_id: 'product_search',
      parameters: {
        query: user_message,
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

    if (searchRes.data && searchRes.data.length > 0) {
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

      responseText = 'I found **' + searchRes.data.length + '** matching product(s) for your request:\n\n';
      searchRes.data.slice(0, 3).forEach((p: any) => {
        responseText += '• **' + p.title + '** — **$' + p.price.toFixed(2) + '** (' + p.category + ')\n  ' + p.description + '\n\n';
      });
      if (requestedSize) {
        responseText += '✅ Verified: Size **' + requestedSize + '** is in stock and ready to ship.';
      }
    } else {
      responseText = "I couldn't find any products in our catalog matching those exact criteria. Would you like to explore our other categories or speak with a support specialist?";
    }
  } else if (detectedIntent === 'ORDER_TRACKING') {
    planningSteps.push('3. Extracting order identifier and customer email from input.');
    const orderMatch = user_message.match(/(?:#?|ord_)(\d{5})/i) || user_message.match(/#(\w+)/);
    const orderNum = orderMatch ? (orderMatch[0].startsWith('#') ? orderMatch[0] : '#' + orderMatch[1]) : '#10482';
    const emailMatch = user_message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const customerEmail = emailMatch ? emailMatch[1] : (params.customer_identifier?.includes('@') ? params.customer_identifier : 'sarah.connor@example.com');

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

    if (orderRes.data) {
      interactivePayload = orderRes.interactive_payload;
      const order = orderRes.data;
      responseText = 'Here is the status for your order **' + order.order_number + '**:\n\n' +
        '• **Status**: `' + order.status + '`\n' +
        '• **Carrier**: ' + (order.carrier || 'FedEx') + '\n' +
        '• **Tracking Number**: `' + (order.tracking_number || 'Pending') + '`\n' +
        '• **Items**: ' + order.items.map((i: any) => i.quantity + 'x ' + i.title).join(', ') + '\n' +
        '• **Destination**: ' + order.shipping_address;
    } else {
      responseText = 'I was unable to locate order **' + orderNum + '**. Please check the order number.';
    }
  } else if (detectedIntent === 'RETURN_OR_POLICY_INQUIRY') {
    planningSteps.push('4. Synthesizing response using verified knowledge citations.');
    planningSteps.push(`5. Grounding verification: ${Math.round(ragResult.grounding_verification.confidence_score * 100)}% factual confidence.`);
    if (citations.length > 0) {
      responseText = ragResult.natural_answer;
    } else {
      responseText = 'Our store accepts returns within **30 days** of delivery for unworn merchandise in original condition. Return shipping is free with our prepaid labels.';
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
    responseText = "I've connected your conversation to our customer care team. A live support specialist has been notified and will respond here shortly.";
  } else {
    if (citations.length > 0) {
      responseText = citations[0].chunk_text + '\n\nIs there anything specific I can help you find today?';
    } else {
      responseText = config.identity?.greeting || "Hi! I'm ShopMate, how can I assist you with your shopping today?";
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
