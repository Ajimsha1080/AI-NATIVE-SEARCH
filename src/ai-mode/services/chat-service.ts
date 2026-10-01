import { AIModeConversation, AIModeMessage, AIModeProduct } from '../types';
import { aiModeStorage } from './storage';
import { AIModeSearchService } from './ai-search-service';
import { AIModeCartAdapter } from '../adapters/cart-adapter';
import { generateId } from '@/lib/utils';

export class AIModeChatService {
  public static async processMessage(params: {
    conversationId?: string;
    workspaceId: string;
    userMessage: string;
  }): Promise<{
    conversation: AIModeConversation;
    responseMessage: AIModeMessage;
  }> {
    const convId = params.conversationId || `conv_${generateId('aim')}`;
    let conv = aiModeStorage.getConversation(convId);
    
    if (!conv) {
      conv = {
        id: convId,
        workspace_id: params.workspaceId,
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const userMsg: AIModeMessage = {
      id: `msg_${generateId('user')}`,
      role: 'user',
      content: params.userMessage,
      created_at: new Date().toISOString()
    };
    conv.messages.push(userMsg);

    const queryLower = params.userMessage.toLowerCase().trim();

    // 1. Check for Cart Action ("add the second one", "add to cart")
    let cartActionResult: AIModeMessage['cart_action_performed'];
    if (/\b(add\s+to\s+cart|buy|add\s+(?:the\s+)?(first|second|third|1st|2nd|3rd|last|this|that))\b/i.test(queryLower)) {
      const lastAssistantMsg = [...conv.messages].reverse().find(m => m.role === 'assistant' && (m.products || []).length > 0);
      if (lastAssistantMsg && lastAssistantMsg.products && lastAssistantMsg.products.length > 0) {
        let targetProduct: AIModeProduct = lastAssistantMsg.products[0];
        if (/\b(second|2nd)\b/i.test(queryLower) && lastAssistantMsg.products.length > 1) {
          targetProduct = lastAssistantMsg.products[1];
        } else if (/\b(third|3rd)\b/i.test(queryLower) && lastAssistantMsg.products.length > 2) {
          targetProduct = lastAssistantMsg.products[2];
        } else if (/\b(last)\b/i.test(queryLower)) {
          targetProduct = lastAssistantMsg.products[lastAssistantMsg.products.length - 1];
        }

        await AIModeCartAdapter.addToCart({ product_id: targetProduct.id, workspaceId: params.workspaceId });
        cartActionResult = {
          action: 'ADD',
          product_title: targetProduct.title,
          quantity: 1
        };

        const responseMsg: AIModeMessage = {
          id: `msg_${generateId('ast')}`,
          role: 'assistant',
          content: `Added **${targetProduct.title}** (₹${targetProduct.price.toLocaleString('en-IN')}) to your shopping bag! 🛍️ Would you like to view other matching recommendations?`,
          products: [targetProduct],
          cart_action_performed: cartActionResult,
          created_at: new Date().toISOString()
        };

        conv.messages.push(responseMsg);
        conv.updated_at = new Date().toISOString();
        aiModeStorage.saveConversation(conv);

        return { conversation: conv, responseMessage: responseMsg };
      }
    }

    // 2. Check for Comparison Intent ("compare", "which is better")
    if (/\b(compare|which\s+is\s+better|difference\s+between|vs)\b/i.test(queryLower)) {
      const lastAssistantMsg = [...conv.messages].reverse().find(m => m.role === 'assistant' && (m.products || []).length >= 2);
      if (lastAssistantMsg && lastAssistantMsg.products && lastAssistantMsg.products.length >= 2) {
        const itemA = lastAssistantMsg.products[0];
        const itemB = lastAssistantMsg.products[1];
        const diffPrice = Math.abs(itemA.price - itemB.price);
        const cheaper = itemA.price <= itemB.price ? itemA : itemB;

        const responseMsg: AIModeMessage = {
          id: `msg_${generateId('ast')}`,
          role: 'assistant',
          content: `Here is a side-by-side comparison between **${itemA.title}** and **${itemB.title}**:\n\n` +
            `• **${cheaper.title}** is more budget-friendly at ₹${cheaper.price.toLocaleString('en-IN')} (saves ₹${diffPrice.toLocaleString('en-IN')}).\n` +
            `• Both options are currently in-stock and available directly from our verified store collection.`,
          comparison: {
            item_a: itemA,
            item_b: itemB,
            pros_a: [`Price: ₹${itemA.price}`, `Category: ${itemA.category}`, 'Verified authentic'],
            pros_b: [`Price: ₹${itemB.price}`, `Category: ${itemB.category}`, 'Verified authentic'],
            summary: `${cheaper.title} is the more affordable option with high store ratings.`
          },
          products: [itemA, itemB],
          created_at: new Date().toISOString()
        };

        conv.messages.push(responseMsg);
        conv.updated_at = new Date().toISOString();
        aiModeStorage.saveConversation(conv);

        return { conversation: conv, responseMessage: responseMsg };
      }
    }

    // 3. Search & Discovery Execution
    const plan = AIModeSearchService.parseQuery(params.userMessage, conv.last_search_state);
    
    // Support pagination / show more
    if (/\b(show\s+more|next\s+page|load\s+more|more\s+results)\b/i.test(queryLower) && conv.last_search_state) {
      plan.pagination.page = (conv.last_search_state.pagination.page || 1) + 1;
    }

    const searchResult = await AIModeSearchService.search(plan, params.workspaceId);
    conv.last_search_state = plan;

    let assistantText = '';
    if (searchResult.products.length === 0) {
      assistantText = `I couldn't find any products matching "${params.userMessage}". Try adjusting your budget or exploring our featured categories.`;
    } else if (plan.intent === 'RECOMMENDATION') {
      assistantText = `Based on your request, here are top recommended picks from our store:`;
    } else if (plan.intent === 'REFINEMENT') {
      assistantText = `Updated your search with new filters. Here are the matching options:`;
    } else {
      assistantText = `Found ${searchResult.total_matches} matching product${searchResult.total_matches === 1 ? '' : 's'}:`;
    }

    const responseMsg: AIModeMessage = {
      id: `msg_${generateId('ast')}`,
      role: 'assistant',
      content: assistantText,
      products: searchResult.products,
      recommendations: plan.intent === 'RECOMMENDATION' ? searchResult.products.slice(0, 3) : undefined,
      created_at: new Date().toISOString()
    };

    conv.messages.push(responseMsg);
    conv.updated_at = new Date().toISOString();
    aiModeStorage.saveConversation(conv);

    return { conversation: conv, responseMessage: responseMsg };
  }
}
