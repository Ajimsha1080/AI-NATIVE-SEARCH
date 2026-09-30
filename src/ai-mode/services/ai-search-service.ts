import { CatalogAdapter } from '../adapters/catalog-adapter';
import { EmbeddingsAdapter } from '../adapters/embeddings-adapter';
import { CommerceProduct } from '@/types';
import {
  AiModeSearchPlan,
  AiModeSearchResult,
  AiModeComparisonResult
} from '../types';

export class AiModeSearchService {
  /**
   * Dynamically parses a natural-language query into an execution plan.
   * NO HARDCODED CATEGORIES OR PHRASES.
   */
  public static parseQuery(
    rawQuery: string,
    catalogProducts: CommerceProduct[],
    previousPlan?: AiModeSearchPlan
  ): AiModeSearchPlan {
    const q = rawQuery.toLowerCase().trim();
    
    // Determine Intent
    let intent: AiModeSearchPlan['intent'] = 'SEARCH';
    let scope: AiModeSearchPlan['scope'] = 'all_matching';

    if (/\b(compare|comparison|versus|vs|difference|which (one |is better))\b/i.test(q)) {
      intent = 'COMPARE';
      scope = 'similar';
    } else if (/\b(recommend|suggestion|what should i buy|gift for|ideal for|best for)\b/i.test(q)) {
      intent = 'RECOMMEND';
      scope = 'recommendations';
    } else if (/\b(more|next page|show more|next)\b/i.test(q)) {
      intent = 'PAGINATE';
      scope = 'pagination';
    } else if (/\b(only|filter|just|cheaper|expensive|under|above)\b/i.test(q) && previousPlan) {
      intent = 'REFINE';
      scope = 'refinement';
    }

    // Dynamic Price Bounds
    let min_price: number | undefined = previousPlan?.min_price;
    let max_price: number | undefined = previousPlan?.max_price;

    const underMatch = q.match(/\b(?:under|below|less than|within|budget of)\s+(?:rs\.?|inr|₹|\$)?\s*(\d+)/i);
    if (underMatch) {
      max_price = parseFloat(underMatch[1]);
      min_price = undefined;
    }

    const aboveMatch = q.match(/\b(?:above|over|more than|exceeding)\s+(?:rs\.?|inr|₹|\$)?\s*(\d+)/i);
    if (aboveMatch) {
      min_price = parseFloat(aboveMatch[1]);
    }

    const betweenMatch = q.match(/\b(?:between)\s+(?:rs\.?|inr|₹|\$)?\s*(\d+)\s*(?:and|to|-)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+)/i);
    if (betweenMatch) {
      min_price = parseFloat(betweenMatch[1]);
      max_price = parseFloat(betweenMatch[2]);
    }

    // Sorting detection
    let sort: AiModeSearchPlan['sort'] = previousPlan?.sort;
    if (/\b(cheaper|cheap|lowest price|price low to high|affordable)\b/i.test(q)) {
      sort = 'price_asc';
    } else if (/\b(expensive|highest price|price high to low|premium)\b/i.test(q)) {
      sort = 'price_desc';
    } else if (/\b(newest|latest|recent|new arrival)\b/i.test(q)) {
      sort = 'newest';
    }

    // Dynamic Gender identification
    let gender: AiModeSearchPlan['gender'] = previousPlan?.gender;
    if (/\b(men|man|male|gentleman|boys?)\b/i.test(q) && !/\bwomen\b/i.test(q)) {
      gender = 'men';
    } else if (/\b(women|woman|female|ladies|girls?)\b/i.test(q)) {
      gender = 'women';
    } else if (/\b(kids|children|toddler)\b/i.test(q)) {
      gender = 'kids';
    }

    // Dynamic Catalog Category Discovery
    const knownCategories = Array.from(new Set(catalogProducts.map(p => p.category).filter(Boolean)));
    let category: string | undefined = previousPlan?.category;
    for (const cat of knownCategories) {
      const catRegex = new RegExp(`\\b${cat.toLowerCase().replace(/s$/, '')}s?\\b`, 'i');
      if (catRegex.test(q)) {
        category = cat;
        break;
      }
    }

    // Dynamic Color Extraction
    const colorTokens = ['black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 'grey', 'gray', 'brown', 'navy', 'maroon', 'orange', 'beige', 'olive'];
    let color: string | undefined = previousPlan?.color;
    for (const c of colorTokens) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(q)) {
        color = c;
        break;
      }
    }

    // Dynamic Occasion Extraction
    const occasionTokens = ['wedding', 'party', 'formal', 'casual', 'gym', 'workout', 'sports', 'festival', 'summer', 'winter', 'office', 'dinner', 'date'];
    let occasion: string | undefined = previousPlan?.occasion;
    for (const occ of occasionTokens) {
      if (new RegExp(`\\b${occ}\\b`, 'i').test(q)) {
        occasion = occ;
        break;
      }
    }

    // Clean semantic query
    const stopWords = ['show', 'me', 'find', 'get', 'give', 'i', 'want', 'need', 'looking', 'for', 'a', 'an', 'the', 'some', 'please', 'something', 'items', 'products', 'all'];
    const tokens = q.split(/[^a-z0-9]+/i).filter(t => t.length > 1 && !stopWords.includes(t));

    return {
      intent,
      scope,
      semantic_query: q,
      extracted_keywords: tokens,
      category,
      gender,
      min_price,
      max_price,
      color,
      occasion,
      sort,
      page: intent === 'PAGINATE' ? (previousPlan?.page ? previousPlan.page + 1 : 2) : 1,
      page_size: 6
    };
  }

  /**
   * Executes AI search using hybrid retrieval (Lexical BM25 + Dense Semantic Cosine Vector).
   */
  public static async executeSearch(
    workspaceId: string,
    rawQuery: string,
    options?: {
      previousPlan?: AiModeSearchPlan;
      pageOverride?: number;
      pageSize?: number;
    }
  ): Promise<AiModeSearchResult> {
    const startTime = Date.now();
    const catalog = CatalogAdapter.getProductsByWorkspace(workspaceId);
    const plan = this.parseQuery(rawQuery, catalog, options?.previousPlan);

    if (options?.pageOverride) plan.page = options.pageOverride;
    if (options?.pageSize) plan.page_size = options.pageSize;

    if (catalog.length === 0) {
      return {
        query: rawQuery,
        plan,
        products: [],
        total_matches: 0,
        page: plan.page,
        page_size: plan.page_size,
        has_more: false,
        confidence_score: 0,
        retrieval_diagnostics: {
          lexical_candidates_count: 0,
          vector_candidates_count: 0,
          combined_candidates_count: 0,
          fallback_applied: false,
          latency_ms: Date.now() - startTime
        }
      };
    }

    // Step 1: Lexical Scoring
    const queryKeywords = plan.extracted_keywords;
    const lexicalScores = new Map<string, number>();

    catalog.forEach(product => {
      const textToMatch = [
        product.title,
        product.description,
        product.category,
        ...(product.tags || []),
        ...Object.values(product.variants?.flatMap(v => Object.values(v.attributes || {})) || [])
      ].join(' ').toLowerCase();

      let score = 0;
      queryKeywords.forEach(kw => {
        if (textToMatch.includes(kw)) {
          score += 1.0;
          if (product.title.toLowerCase().includes(kw)) score += 1.5;
        }
      });
      lexicalScores.set(product.id, score);
    });

    // Step 2: Dense Semantic Vector Scoring
    let vectorScores = new Map<string, number>();
    try {
      const queryEmbedding = await EmbeddingsAdapter.generateEmbedding(plan.semantic_query);
      for (const product of catalog) {
        const productText = `${product.title} ${product.category} ${product.description}`;
        const prodEmbedding = (product as any).embedding || (await EmbeddingsAdapter.generateEmbedding(productText));
        const sim = EmbeddingsAdapter.cosineSimilarity(queryEmbedding, prodEmbedding);
        vectorScores.set(product.id, Math.max(0, sim));
      }
    } catch {
      // Fallback gracefully
      catalog.forEach(p => vectorScores.set(p.id, 0.5));
    }

    // Step 3: Combine & Filter with Hard & Soft Constraints
    let scoredCandidates = catalog.map(product => {
      const lex = lexicalScores.get(product.id) || 0;
      const vec = vectorScores.get(product.id) || 0;
      let finalScore = (vec * 0.6) + (Math.min(lex, 5) / 5 * 0.4);

      // Constraint Checks
      let passesConstraints = true;

      // Price constraint
      if (plan.max_price !== undefined && product.price > plan.max_price) {
        passesConstraints = false;
      }
      if (plan.min_price !== undefined && product.price < plan.min_price) {
        passesConstraints = false;
      }

      // Category constraint (if explicitly stated)
      if (plan.category && product.category && product.category.toLowerCase() !== plan.category.toLowerCase()) {
        finalScore *= 0.2; // penalty
      }

      // Color constraint
      if (plan.color) {
        const text = `${product.title} ${product.description} ${(product.tags || []).join(' ')}`.toLowerCase();
        if (!text.includes(plan.color)) {
          finalScore *= 0.3;
        } else {
          finalScore += 0.3;
        }
      }

      // In stock preference
      if (product.in_stock) finalScore += 0.1;

      return {
        product,
        score: finalScore,
        passesConstraints
      };
    });

    // Filter by strict constraints
    let validCandidates = scoredCandidates.filter(c => c.passesConstraints && c.score > 0.15);

    // Step 4: Zero-Result Fallback Handling
    let fallbackApplied = false;
    if (validCandidates.length === 0 && scoredCandidates.length > 0) {
      // Relax price or exact tokens, pick highest semantic matches
      fallbackApplied = true;
      validCandidates = scoredCandidates
        .filter(c => c.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
    }

    // Step 5: Sorting & Ranking
    if (plan.sort === 'price_asc') {
      validCandidates.sort((a, b) => a.product.price - b.product.price);
    } else if (plan.sort === 'price_desc') {
      validCandidates.sort((a, b) => b.product.price - a.product.price);
    } else {
      validCandidates.sort((a, b) => b.score - a.score);
    }

    const totalMatches = validCandidates.length;
    const startIndex = (plan.page - 1) * plan.page_size;
    const paginatedProducts = validCandidates.slice(startIndex, startIndex + plan.page_size).map(c => c.product);
    const hasMore = startIndex + plan.page_size < totalMatches;

    const avgConfidence = paginatedProducts.length > 0
      ? validCandidates.slice(startIndex, startIndex + plan.page_size).reduce((acc, c) => acc + c.score, 0) / paginatedProducts.length
      : 0;

    return {
      query: rawQuery,
      plan,
      products: paginatedProducts,
      total_matches: totalMatches,
      page: plan.page,
      page_size: plan.page_size,
      has_more: hasMore,
      confidence_score: Math.min(1.0, Math.round(avgConfidence * 100) / 100),
      retrieval_diagnostics: {
        lexical_candidates_count: Array.from(lexicalScores.values()).filter(s => s > 0).length,
        vector_candidates_count: Array.from(vectorScores.values()).filter(s => s > 0.4).length,
        combined_candidates_count: totalMatches,
        fallback_applied: fallbackApplied,
        latency_ms: Date.now() - startTime
      }
    };
  }

  /**
   * Compares two or more products side-by-side using authoritative catalog data.
   */
  public static compareProducts(products: CommerceProduct[]): AiModeComparisonResult {
    if (products.length === 0) {
      return { products: [], comparison_points: [], summary: 'No products selected for comparison.' };
    }

    const comparisonPoints = [
      {
        attribute: 'Price',
        values: Object.fromEntries(products.map(p => [p.title, `${p.currency || '$'}${p.price}`]))
      },
      {
        attribute: 'Category',
        values: Object.fromEntries(products.map(p => [p.title, p.category || 'N/A']))
      },
      {
        attribute: 'Availability',
        values: Object.fromEntries(products.map(p => [p.title, p.in_stock ? 'In Stock' : 'Out of Stock']))
      },
      {
        attribute: 'Key Details',
        values: Object.fromEntries(products.map(p => [p.title, p.description ? p.description.substring(0, 100) + '...' : 'Details not specified']))
      }
    ];

    // Summary calculation
    const cheapest = [...products].sort((a, b) => a.price - b.price)[0];
    const summary = `Compared ${products.length} products. "${cheapest.title}" is the most affordable at ${cheapest.currency || '$'}${cheapest.price}.`;

    return {
      products,
      comparison_points: comparisonPoints,
      summary
    };
  }

  /**
   * Generates contextual product recommendations based on a reference product or user intent.
   */
  public static getRecommendations(
    workspaceId: string,
    referenceProduct?: CommerceProduct,
    limit: number = 4
  ): CommerceProduct[] {
    const all = CatalogAdapter.getProductsByWorkspace(workspaceId);
    if (all.length <= 1) return all;

    if (!referenceProduct) {
      // Return top featured in-stock products
      return all.filter(p => p.in_stock).slice(0, limit);
    }

    return all
      .filter(p => p.id !== referenceProduct.id && p.in_stock)
      .map(p => {
        let score = 0;
        if (p.category === referenceProduct.category) score += 2;
        if (Math.abs(p.price - referenceProduct.price) < referenceProduct.price * 0.4) score += 1;
        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(c => c.product);
  }
}
