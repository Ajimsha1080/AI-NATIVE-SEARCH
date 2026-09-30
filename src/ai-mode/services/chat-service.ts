import { aiModeStorage } from './storage';
import { AiModeSearchService } from './ai-search-service';
import { CartAdapter } from '../adapters/cart-adapter';
import { CatalogAdapter } from '../adapters/catalog-adapter';
import {
  AiModeChatMessage,
  AiModeConversation,
  AiModeSearchPlan
} from '../types';

export class AiModeChatService {
  /**
   * Processes a user message in an ongoing or new conversation.
   */
  public static async handleMessage(
    workspaceId: string,
    sessionId: string,
    userText: string
  ): Promise<{
    message: AiModeChatMessage;
    conversation: AiModeConversation;
  }> {
    let conversation = aiModeStorage.getConversation(sessionId, workspaceId);
    if (!conversation) {
      conversation = {
        id: `aimode_conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspace_id: workspaceId,
        session_id: sessionId,
        messages: [],
        context: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    // Append user message
    const userMsg: AiModeChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    };
    conversation.messages.push(userMsg);

    const q = userText.toLowerCase().trim();

    // 1. Check for Cart Action ("add to cart", "add the second one", "buy this")
    const cartOrdinalMatch = q.match(/\badd\s+(?:the\s+)?(first|second|third|fourth|1st|2nd|3rd|4th|\d+)\s*(?:one|item|product)?\b/i);
    const cartGenericMatch = /\badd\s+(?:it|this)\s+to\s+cart\b/i.test(q);

    if (cartOrdinalMatch || cartGenericMatch) {
      const lastProducts = conversation.context.last_products || [];
      let targetIdx = 0;

      if (cartOrdinalMatch) {
        const ord = cartOrdinalMatch[1].toLowerCase();
        if (ord === 'first' || ord === '1st' || ord === '1') targetIdx = 0;
        else if (ord === 'second' || ord === '2nd' || ord === '2') targetIdx = 1;
        else if (ord === 'third' || ord === '3rd' || ord === '3') targetIdx = 2;
        else if (ord === 'fourth' || ord === '4th' || ord === '4') targetIdx = 3;
        else targetIdx = Math.max(0, parseInt(ord, 10) - 1);
      }

      const targetProduct = lastProducts[targetIdx] || lastProducts[0];
      if (targetProduct) {
        const cartResult = CartAdapter.addToCart(workspaceId, sessionId, targetProduct.id, 1);
        const assistantMsg: AiModeChatMessage = {
          id: `msg_asst_${Date.now()}`,
          role: 'assistant',
          content: `I've added **${targetProduct.title}** to your cart for ${targetProduct.currency || '$'}${targetProduct.price}. Would you like to view more items or proceed to checkout?`,
          timestamp: new Date().toISOString(),
          products: [targetProduct],
          suggested_actions: ['Show similar products', 'View more options', 'Checkout now']
        };
        conversation.messages.push(assistantMsg);
        aiModeStorage.saveConversation(conversation);
        return { message: assistantMsg, conversation };
      }
    }

    // 2. Check for Product Comparison
    if (/\b(compare|versus|vs|difference|which one is better)\b/i.test(q)) {
      const lastProducts = conversation.context.last_products || [];
      const productsToCompare = lastProducts.length >= 2 ? lastProducts.slice(0, 3) : CatalogAdapter.getProductsByWorkspace(workspaceId).slice(0, 2);
      
      if (productsToCompare.length > 0) {
        const comparison = AiModeSearchService.compareProducts(productsToCompare);
        const assistantMsg: AiModeChatMessage = {
          id: `msg_asst_${Date.now()}`,
          role: 'assistant',
          content: `Here is a side-by-side comparison of the items:\n\n${comparison.summary}`,
          timestamp: new Date().toISOString(),
          products: productsToCompare,
          comparison,
          suggested_actions: ['Add the first one to cart', 'Add the second one to cart', 'Show cheaper options']
        };
        conversation.messages.push(assistantMsg);
        aiModeStorage.saveConversation(conversation);
        return { message: assistantMsg, conversation };
      }
    }

    // 3. Check for Recommendations
    if (/\b(recommend|suggest|what should i buy|gift ideas)\b/i.test(q)) {
      const recs = AiModeSearchService.getRecommendations(
        workspaceId,
        conversation.context.last_products?.[0],
        4
      );
      const assistantMsg: AiModeChatMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: `Based on your request, here are top recommendations tailored for you:`,
        timestamp: new Date().toISOString(),
        products: recs,
        suggested_actions: ['Compare these items', 'Show lower price', 'Show more']
      };
      conversation.context.last_products = recs;
      conversation.messages.push(assistantMsg);
      aiModeStorage.saveConversation(conversation);
      return { message: assistantMsg, conversation };
    }

    // 4. Standard Search & Refinement / Pagination
    const previousPlan = conversation.context.last_search_plan;
    const searchResult = await AiModeSearchService.executeSearch(workspaceId, userText, {
      previousPlan
    });

    conversation.context.last_search_plan = searchResult.plan;
    conversation.context.last_products = searchResult.products;

    let responseText = '';
    if (searchResult.products.length === 0) {
      responseText = `I couldn't find exact products matching "${userText}". Try exploring broader keywords or adjusting price filters.`;
    } else if (searchResult.plan.intent === 'PAGINATE') {
      responseText = `Here are the next ${searchResult.products.length} products (Page ${searchResult.page}):`;
    } else if (searchResult.plan.intent === 'REFINE') {
      responseText = `Refined your search. Found ${searchResult.total_matches} matching items:`;
    } else {
      responseText = `Found ${searchResult.total_matches} matching product${searchResult.total_matches === 1 ? '' : 's'}:`;
    }

    const assistantMsg: AiModeChatMessage = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      products: searchResult.products,
      pagination: {
        page: searchResult.page,
        pageSize: searchResult.page_size,
        totalMatches: searchResult.total_matches,
        hasMore: searchResult.has_more
      },
      suggested_actions: searchResult.has_more
        ? ['Show more', 'Compare top results', 'Filter cheaper options']
        : ['Compare top results', 'Show similar products']
    };

    conversation.messages.push(assistantMsg);
    aiModeStorage.saveConversation(conversation);

    return { message: assistantMsg, conversation };
  }
}
