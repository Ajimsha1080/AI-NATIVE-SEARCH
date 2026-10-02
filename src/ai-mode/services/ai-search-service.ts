import { AIModeProduct, AIModeSearchPlan, AIModeSearchResult } from '../types';
import { AIModeCatalogAdapter } from '../adapters/catalog-adapter';
import { AIModeEmbeddingsAdapter } from '../adapters/embeddings-adapter';

const STOP_WORDS = new Set([
  'product', 'products', 'item', 'items', 'show', 'me', 'find', 'get', 'give',
  'all', 'the', 'a', 'an', 'in', 'for', 'of', 'to', 'with', 'and', 'or', 'some',
  'please', 'looking', 'look', 'want', 'need', 'buy', 'shop', 'display', 'list',
  'available', 'good', 'best', 'top', 'any', 'have', 'you', 'can', 'is', 'are'
]);

const EXPLORATORY_WORDS = new Set([
  'new', 'latest', 'recent', 'arrival', 'arrivals', 'trending', 'popular', 
  'featured', 'bestseller', 'bestsellers', 'hot', 'everything', 'browse', 
  'collection', 'catalog', 'stuff', 'clothes', 'clothing', 'apparel'
]);

export class AIModeSearchService {
  /**
   * General-purpose dynamic query understanding with gender, category, and constraint extraction.
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

    // 2. Extract Gender & Demographic intent
    let gender: string | undefined;
    if (/\b(women|woman|womens|women's|female|ladies|lady|girls|girl)\b/i.test(queryLower)) {
      gender = 'women';
    } else if (/\b(men|mens|men's|male|man|guys|guy|boys|boy)\b/i.test(queryLower)) {
      gender = 'men';
    } else if (/\b(kids|kid|children|child|baby|toddler)\b/i.test(queryLower)) {
      gender = 'kids';
    } else if (/\b(unisex|couples?|couple\s+combo)\b/i.test(queryLower)) {
      gender = 'unisex';
    }

    // 3. Extract Category
    let category: string | undefined;
    if (/\b(saree|sarees)\b/i.test(queryLower)) category = 'Saree';
    else if (/\b(bow|bows|hair\s*clip|hair\s*accessories|scrunchie|scrunchies|accessory|accessories)\b/i.test(queryLower)) category = 'Bow';
    else if (/\b(couple\s*combo|box\s*combo|combos?)\b/i.test(queryLower)) category = 'Combo';
    else if (/\b(dresses?|kurtis?|skirts?|frock)\b/i.test(queryLower)) category = 'Dress';
    else if (/\b(t-?shirts?|tees?|oversized\s*tee)\b/i.test(queryLower)) category = 'T-Shirt';
    else if (/\b(shirts?|half\s*sleeve|full\s*sleeve|printed\s*shirt)\b/i.test(queryLower)) category = 'Shirt';
    else if (/\b(hoodies?|sweatshirts?)\b/i.test(queryLower)) category = 'Hoodie';
    else if (/\b(jackets?|bomber|outerwear)\b/i.test(queryLower)) category = 'Jacket';
    else if (/\b(pants?|joggers?|trousers?|cargos?|shorts?)\b/i.test(queryLower)) category = 'Pants';
    else if (/\b(shoes?|footwear|sneakers?)\b/i.test(queryLower)) category = 'Shoes';

    // 4. Extract Color
    let color: string | undefined;
    const colorMatch = queryLower.match(/\b(black|white|red|green|yellow|blue|brown|grey|gray|pink|purple|emerald|maroon|beige|navy|orange|gold|silver|olive|cream)\b/i);
    if (colorMatch) {
      color = colorMatch[1];
    }

    // 5. Extract Price Constraints dynamically
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

    // 6. Sorting
    let sort: AIModeSearchPlan['sort'] = 'relevance';
    if (/\b(cheap|cheaper|lowest\s+price|low\s+to\s+high|price\s+low)\b/i.test(queryLower)) {
      sort = 'price_asc';
    } else if (/\b(expensive|highest\s+price|high\s+to\s+low|price\s+high)\b/i.test(queryLower)) {
      sort = 'price_desc';
    } else if (/\b(latest|new|newest|recent|arrivals?)\b/i.test(queryLower)) {
      sort = 'newest';
    }

    // 7. Inherit previous filters if refinement
    const extracted_filters: AIModeSearchPlan['extracted_filters'] = {
      ...(previousState?.extracted_filters || {}),
      ...(gender ? { gender } : {}),
      ...(category ? { category } : {}),
      ...(color ? { color } : {}),
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
        page_size: 48
      }
    };
  }

  /**
   * Execute Hybrid Dense + Lexical retrieval with demographic gating, exploratory support, and ranking.
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

    const queryLower = plan.semantic_query.toLowerCase().trim();
    const targetGender = plan.extracted_filters.gender;
    const targetCategory = plan.extracted_filters.category?.toLowerCase();
    const targetColor = plan.extracted_filters.color?.toLowerCase();

    // Extract meaningful tokens (non-stopwords)
    const rawTokens = queryLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    const meaningfulTokens = rawTokens.filter(t => t.length > 1 && !STOP_WORDS.has(t));

    // Check if query is an exploratory / broad catalog query (e.g. "new products", "all items", "latest collection")
    const specificKeywordTokens = meaningfulTokens.filter(t => !EXPLORATORY_WORDS.has(t));
    const isExploratoryQuery = meaningfulTokens.length === 0 || specificKeywordTokens.length === 0;
    const isNewArrivalsQuery = /\b(new|latest|recent|arrivals?)\b/i.test(queryLower);
    const isTrendingQuery = /\b(trending|popular|bestseller|best\s*sellers|top\s*sellers)\b/i.test(queryLower);

    const queryVector = AIModeEmbeddingsAdapter.generateVector(plan.semantic_query);

    // Score candidates
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

      // Build product searchable text
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const catLower = (product.category || '').toLowerCase();
      const tagsLower = (product.subcategories || []).map(t => t.toLowerCase());
      const allProductText = `${titleLower} ${descLower} ${catLower} ${tagsLower.join(' ')}`;

      // 2. Gender & Demographic Compatibility Check
      const isExplicitlyWomen = /\b(women|woman|womens|women's|female|ladies|lady|girl|girls|saree|sarees|bow|bows|hair|scrunchie|scrunchies|dress|dresses|kurti|kurtis|skirt|skirts)\b/i.test(allProductText) || catLower.includes('saree') || catLower.includes('bow');
      const isExplicitlyMen = (/\b(men|mens|men's|male|man|guys|boy|boys)\b/i.test(allProductText) || tagsLower.includes('men') || descLower.includes('for men') || descLower.includes("men's")) && !isExplicitlyWomen;
      const isUnisexOrCombo = /\b(unisex|couple|combo|oversized|streetwear|tee|t-shirt|hoodie|jacket)\b/i.test(allProductText) || catLower.includes('combo') || catLower.includes('couple');

      let demographicScoreBonus = 0;

      if (targetGender === 'women') {
        if (isExplicitlyWomen) {
          demographicScoreBonus += 0.50;
        } else if (isUnisexOrCombo && !isExplicitlyMen) {
          demographicScoreBonus += 0.20;
        } else if (isExplicitlyMen && !isExplicitlyWomen && !isUnisexOrCombo) {
          continue; // Exclude men-only items for women queries
        }
      } else if (targetGender === 'men') {
        if (isExplicitlyWomen && !isUnisexOrCombo) {
          continue; // Exclude women-only items for men queries
        } else if (isExplicitlyMen) {
          demographicScoreBonus += 0.40;
        } else if (isUnisexOrCombo) {
          demographicScoreBonus += 0.20;
        }
      } else if (targetGender === 'kids') {
        const isKids = /\b(kids?|children|child|baby|toddler|boy|girl)\b/i.test(allProductText);
        if (!isKids) continue;
        demographicScoreBonus += 0.50;
      }

      // 3. Category Match Check
      let categoryBonus = 0;
      if (targetCategory) {
        if (catLower.includes(targetCategory) || tagsLower.some(t => t.includes(targetCategory)) || titleLower.includes(targetCategory)) {
          categoryBonus += 0.40;
        } else if (!isExploratoryQuery) {
          // If a specific category was requested and this item doesn't match, penalize
          categoryBonus -= 0.30;
        }
      }

      // 4. Color Match Check
      let colorBonus = 0;
      if (targetColor) {
        if (titleLower.includes(targetColor) || descLower.includes(targetColor) || tagsLower.includes(targetColor)) {
          colorBonus += 0.30;
        } else if (!isExploratoryQuery) {
          colorBonus -= 0.20;
        }
      }

      // 5. Exploratory Modifiers (New Arrivals / Best Sellers)
      let exploratoryBonus = 0;
      if (isNewArrivalsQuery) {
        const hasNewTag = tagsLower.some(t => t.includes('new') || t.includes('arrival') || t.includes('2026') || t.includes('aug') || t.includes('june'));
        if (hasNewTag || titleLower.includes('new')) {
          exploratoryBonus += 0.35;
        } else {
          exploratoryBonus += 0.15;
        }
      } else if (isTrendingQuery) {
        const hasTrendingTag = tagsLower.some(t => t.includes('bestseller') || t.includes('top seller') || t.includes('popular') || t.includes('staple'));
        if (hasTrendingTag) {
          exploratoryBonus += 0.35;
        } else {
          exploratoryBonus += 0.15;
        }
      }

      // 6. Lexical Token Relevance (Weighted across title, category, tags, description)
      let lexicalHits = 0;
      let titleHits = 0;
      let tagHits = 0;

      const tokensToCheck = specificKeywordTokens.length > 0 
        ? specificKeywordTokens 
        : (meaningfulTokens.length > 0 ? meaningfulTokens : (targetGender ? [targetGender] : []));

      for (const token of tokensToCheck) {
        const tokenRegex = new RegExp(`\\b${token}`, 'i');
        if (tokenRegex.test(titleLower)) {
          titleHits++;
          lexicalHits++;
        } else if (tagsLower.some(t => tokenRegex.test(t)) || tokenRegex.test(catLower)) {
          tagHits++;
          lexicalHits++;
        } else if (tokenRegex.test(descLower)) {
          lexicalHits += 0.5;
        }
      }

      const lexicalScore = tokensToCheck.length > 0 ? (titleHits * 0.5 + tagHits * 0.3 + (lexicalHits - titleHits - tagHits) * 0.2) / tokensToCheck.length : 0;

      // Exact phrase match bonus
      let exactBonus = 0;
      if (specificKeywordTokens.length > 1 && allProductText.includes(specificKeywordTokens.join(' '))) {
        exactBonus = 0.25;
      }

      // 7. Dense Semantic Vector Score
      const productVector = AIModeEmbeddingsAdapter.generateVector(allProductText);
      const semanticScore = AIModeEmbeddingsAdapter.calculateSimilarity(queryVector, productVector);

      // 8. Combined Weighted Score
      // If user had specific keywords (e.g. "red cotton shirt"), require at least lexical or category hit
      if (specificKeywordTokens.length > 0 && lexicalHits === 0 && demographicScoreBonus === 0 && categoryBonus <= 0 && colorBonus <= 0) {
        continue;
      }

      // Base score for exploratory queries is 0.50 so all valid catalog items display
      const baseScore = isExploratoryQuery ? 0.50 : 0.0;

      const totalScore = Math.min(
        0.99,
        baseScore +
        (lexicalScore * 0.35) + 
        (semanticScore * 0.20) + 
        demographicScoreBonus + 
        categoryBonus + 
        colorBonus + 
        exploratoryBonus +
        exactBonus
      );

      if (totalScore >= 0.20 || isExploratoryQuery) {
        scoredCandidates.push({
          product: { ...product, score: parseFloat(totalScore.toFixed(2)) },
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
