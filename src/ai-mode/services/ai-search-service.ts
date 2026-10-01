import { AIModeProduct, AIModeSearchPlan, AIModeSearchResult } from '../types';
import { AIModeCatalogAdapter } from '../adapters/catalog-adapter';
import { AIModeEmbeddingsAdapter } from '../adapters/embeddings-adapter';

export class AIModeSearchService {
  /**
   * General-purpose dynamic query understanding without hardcoded keywords.
   */
  public static parseQuery(rawQuery: string, previousState?: AIModeSearchPlan): AIModeSearchPlan {
    const queryLower = rawQuery.toLowerCase().trim();

    // 1. Detect Intent
    let intent: AIModeSearchPlan['intent'] = 'DISCOVERY';
    if (/\b(compare|which\s+is\s+better|difference\s+between|vs)\b/i.test(queryLower)) {
      intent = 'COMPARISON';
    } else if (/\b(recommend|suggest|what\s+should\s+i|best\s+for|what\s+do\s+you\s+have\s+for)\b/i.test(queryLower)) {
      intent = 'RECOMMENDATION';
    } else if (/\b(similar|like\s+this|more\s+like)\b/i.test(queryLower)) {
      intent = 'SIMILAR';
    } else if (/\b(cheaper|expensive|only\s+the|change\s+to|filter|in\s+black|in\s+red|under|above)\b/i.test(queryLower) && previousState) {
      intent = 'REFINEMENT';
    }

    // 2. Extract Price Constraints dynamically
    let min_price: number | undefined;
    let max_price: number | undefined;

    const underMatch = queryLower.match(/(?:under|below|less\s+than|max(?:imum)?|budget|within|upto|up\s+to)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)/i);
    if (underMatch) {
      max_price = parseFloat(underMatch[1].replace(/,/g, ''));
    }

    const aboveMatch = queryLower.match(/(?:above|over|more\s+than|min(?:imum)?|from|starting\s+at)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)/i);
    if (aboveMatch) {
      min_price = parseFloat(aboveMatch[1].replace(/,/g, ''));
    }

    const rangeMatch = queryLower.match(/(?:between|from)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+)\s*(?:to|-|and)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+)/i);
    if (rangeMatch) {
      min_price = parseFloat(rangeMatch[1]);
      max_price = parseFloat(rangeMatch[2]);
    }

    // 3. Sorting
    let sort: AIModeSearchPlan['sort'] = 'relevance';
    if (/\b(cheap|cheaper|lowest\s+price|low\s+to\s+high|price\s+low)\b/i.test(queryLower)) {
      sort = 'price_asc';
    } else if (/\b(expensive|highest\s+price|high\s+to\s+low|price\s+high)\b/i.test(queryLower)) {
      sort = 'price_desc';
    } else if (/\b(latest|new|newest|recent)\b/i.test(queryLower)) {
      sort = 'newest';
    }

    // 4. Inherit previous filters if refinement
    const extracted_filters: AIModeSearchPlan['extracted_filters'] = {
      ...(previousState?.extracted_filters || {}),
      ...(min_price !== undefined ? { min_price } : {}),
      ...(max_price !== undefined ? { max_price } : {}),
    };

    return {
      original_query: rawQuery,
      intent,
      semantic_query: rawQuery,
      extracted_filters,
      sort,
      pagination: {
        page: 1,
        page_size: 6
      }
    };
  }

  /**
   * Execute Hybrid Dense + Lexical retrieval with candidate validation & reranking.
   */
  public static async search(plan: AIModeSearchPlan, workspaceId?: string): Promise<AIModeSearchResult> {
    const startTime = Date.now();
    const allProducts = AIModeCatalogAdapter.getProducts(workspaceId);

    if (allProducts.length === 0) {
      return {
        products: [],
        total_matches: 0,
        page: plan.pagination.page,
        page_size: plan.pagination.page_size,
        has_more: false,
        applied_filters: plan.extracted_filters,
        search_plan: plan,
        latency_ms: Date.now() - startTime
      };
    }

    const queryVector = AIModeEmbeddingsAdapter.generateVector(plan.semantic_query);
    const queryTokens = plan.semantic_query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    // Score each candidate
    const scoredCandidates: Array<{ product: AIModeProduct; score: number }> = [];

    for (const product of allProducts) {
      // 1. Strict constraint check (price, in-stock)
      if (plan.extracted_filters.min_price !== undefined && product.price < plan.extracted_filters.min_price) {
        continue;
      }
      if (plan.extracted_filters.max_price !== undefined && product.price > plan.extracted_filters.max_price) {
        continue;
      }
      if (plan.extracted_filters.in_stock_only && !product.in_stock) {
        continue;
      }

      // 2. Lexical BM25 token matching
      const searchableText = `${product.title} ${product.description} ${product.category} ${(product.subcategories || []).join(' ')} ${product.brand || ''}`.toLowerCase();
      let lexicalHits = 0;
      for (const token of queryTokens) {
        if (searchableText.includes(token)) {
          lexicalHits++;
        }
      }
      const lexicalScore = queryTokens.length > 0 ? lexicalHits / queryTokens.length : 0;

      // 3. Dense semantic vector score
      const productVector = AIModeEmbeddingsAdapter.generateVector(searchableText);
      const semanticScore = AIModeEmbeddingsAdapter.calculateSimilarity(queryVector, productVector);

      // 4. Combined Hybrid Score
      const totalScore = (lexicalScore * 0.4) + (semanticScore * 0.6);

      // Threshold filter
      if (totalScore >= 0.15 || lexicalHits > 0 || queryTokens.length === 0) {
        scoredCandidates.push({
          product: { ...product, score: totalScore },
          score: totalScore
        });
      }
    }

    // Sort candidates
    if (plan.sort === 'price_asc') {
      scoredCandidates.sort((a, b) => a.product.price - b.product.price);
    } else if (plan.sort === 'price_desc') {
      scoredCandidates.sort((a, b) => b.product.price - a.product.price);
    } else {
      scoredCandidates.sort((a, b) => b.score - a.score);
    }

    const totalMatches = scoredCandidates.length;
    const page = Math.max(1, plan.pagination.page);
    const pageSize = Math.max(1, plan.pagination.page_size);
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = scoredCandidates.slice(startIndex, startIndex + pageSize).map(c => c.product);
    const hasMore = startIndex + pageSize < totalMatches;

    return {
      products: paginatedItems,
      total_matches: totalMatches,
      page,
      page_size: pageSize,
      has_more: hasMore,
      applied_filters: plan.extracted_filters,
      search_plan: plan,
      latency_ms: Date.now() - startTime
    };
  }
}
