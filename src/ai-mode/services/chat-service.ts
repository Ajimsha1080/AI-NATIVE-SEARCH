import { AIModeConversation, AIModeMessage, AIModeProduct } from '../types';
import { aiModeStorage } from './storage';
import { AIModeSearchService } from './ai-search-service';
import { AIModeCatalogAdapter } from '../adapters/catalog-adapter';
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

    // -------------------------------------------------------------
    // 1. Check for Cart Action ("add the second one", "add to cart")
    // -------------------------------------------------------------
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
        const cartActionResult: AIModeMessage['cart_action_performed'] = {
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

    // -------------------------------------------------------------
    // 2. Check for Comparison Intent ("which one is better?", "compare")
    // -------------------------------------------------------------
    const isComparisonIntent = /\b(compare|which\s+(?:one\s+)?(?:is\s+)?(?:better|best|cheaper|preferable)|difference\s+between|vs|recommend\s+between|which\s+should\s+i\s+(?:buy|get|choose))\b/i.test(queryLower);
    
    if (isComparisonIntent) {
      // Find candidate products to compare from previous turn or catalog
      const lastAssistantMsg = [...conv.messages].reverse().find(m => m.role === 'assistant' && (m.products || []).length >= 2);
      let itemA: AIModeProduct | undefined;
      let itemB: AIModeProduct | undefined;

      if (lastAssistantMsg && lastAssistantMsg.products && lastAssistantMsg.products.length >= 2) {
        itemA = lastAssistantMsg.products[0];
        itemB = lastAssistantMsg.products[1];
      } else {
        const allProds = AIModeCatalogAdapter.getProducts(params.workspaceId);
        if (allProds.length >= 2) {
          itemA = allProds[0];
          itemB = allProds[1];
        }
      }

      if (itemA && itemB) {
        const diffPrice = Math.abs(itemA.price - itemB.price);
        const cheaper = itemA.price <= itemB.price ? itemA : itemB;
        const premium = itemA.price > itemB.price ? itemA : itemB;

        const prosA = [
          `Price: ₹${itemA.price.toLocaleString('en-IN')}`,
          `Category: ${itemA.category}`,
          itemA.in_stock ? 'In Stock (Ready to dispatch)' : 'Limited Availability',
          itemA.description ? itemA.description.substring(0, 75) + '...' : 'Verified quality material'
        ];

        const prosB = [
          `Price: ₹${itemB.price.toLocaleString('en-IN')}`,
          `Category: ${itemB.category}`,
          itemB.in_stock ? 'In Stock (Ready to dispatch)' : 'Limited Availability',
          itemB.description ? itemB.description.substring(0, 75) + '...' : 'Verified quality material'
        ];

        let comparisonSummary = '';
        if (itemA.price === itemB.price) {
          comparisonSummary = `Both **${itemA.title}** and **${itemB.title}** are priced identically at ₹${itemA.price.toLocaleString('en-IN')}. Choose based on your styling preference.`;
        } else {
          comparisonSummary = `If budget is your priority, **${cheaper.title}** saves you ₹${diffPrice.toLocaleString('en-IN')}. However, **${premium.title}** offers premium detailing.`;
        }

        const responseMsg: AIModeMessage = {
          id: `msg_${generateId('ast')}`,
          role: 'assistant',
          content: `Here is a side-by-side comparison between **${itemA.title}** and **${itemB.title}**:\n\n` +
            `• **${cheaper.title}** (₹${cheaper.price.toLocaleString('en-IN')}): Best value pick with high versatility.\n` +
            `• **${premium.title}** (₹${premium.price.toLocaleString('en-IN')}): Premium build with distinct styling.\n\n` +
            `💡 **AI Verdict**: ${comparisonSummary}`,
          comparison: {
            item_a: itemA,
            item_b: itemB,
            pros_a: prosA,
            pros_b: prosB,
            summary: comparisonSummary
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

    // -------------------------------------------------------------
    // 3. Search & Discovery Execution
    // -------------------------------------------------------------
    const plan = AIModeSearchService.parseQuery(params.userMessage, conv.last_search_state);
    
    // Support "show cheaper options"
    if (/\b(cheaper|cheap|lowest\s+price|budget\s+options)\b/i.test(queryLower)) {
      plan.sort = 'price_asc';
    }

    // Support pagination / show more
    if (/\b(show\s+more|next\s+page|load\s+more|more\s+results)\b/i.test(queryLower) && conv.last_search_state) {
      plan.pagination.page = (conv.last_search_state.pagination.page || 1) + 1;
    }

    const searchResult = await AIModeSearchService.search(plan, params.workspaceId);
    conv.last_search_state = plan;

    let assistantText = '';
    if (searchResult.products.length === 0) {
      assistantText = `I couldn't find any products matching "${params.userMessage}". Try adjusting your budget or exploring our featured categories.`;
    } else if (plan.sort === 'price_asc') {
      assistantText = `Here are our most budget-friendly options sorted by price (starting at ₹${searchResult.products[0]?.price.toLocaleString('en-IN')}):`;
    } else if (plan.intent === 'RECOMMENDATION') {
      assistantText = `Based on your preferences, here are handpicked recommendations from our catalog:`;
    } else if (plan.intent === 'REFINEMENT') {
      assistantText = `Updated your search results with your specified filters:`;
    } else {
      assistantText = `Found ${searchResult.total_matches} matching product${searchResult.total_matches === 1 ? '' : 's'} in our collection:`;
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
