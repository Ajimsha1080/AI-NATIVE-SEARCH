import { db } from '../db';
import { CommerceProduct, CommerceOrder, CommerceCart } from '@/types';

export interface CatalogSchema {
  categories: string[];
  tags: string[];
  attributeKeys: string[];
  attributeValues: Record<string, string[]>;
  priceRange: { min: number; max: number; currency: string };
  brands: string[];
}

export interface ProductSearchParams {
  query?: string;
  category?: string;
  subcategories?: string[];
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  brand?: string;
  material?: string;
  occasion?: string;
  style?: string;
  inStockOnly?: boolean;
  attributes?: Record<string, string>;
  page?: number;
  pageSize?: number;
  scope?: 'all_matching' | 'recommendations' | 'specific_product' | 'similar' | 'refinement' | 'pagination';
  sort?: 'price_asc' | 'price_desc' | 'relevance' | 'newest';
}

export interface ProductSearchResult {
  products: CommerceProduct[];
  totalMatches: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  appliedConstraints: Record<string, any>;
  categoriesMatched: string[];
}

export interface ParsedSearchQuery {
  intent: 'PRODUCT_SEARCH' | 'PRODUCT_COMPARISON' | 'INVENTORY_CHECK' | 'CART_ACTION' | 'ORDER_TRACKING' | 'RETURN_OR_POLICY_INQUIRY' | 'HUMAN_HANDOFF' | 'GENERAL_CONVERSATION';
  scope: 'all_matching' | 'recommendations' | 'specific_product' | 'similar' | 'refinement' | 'pagination';
  explicitCategory?: string;
  categoryNegation?: string;
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  brand?: string;
  material?: string;
  attributes: Record<string, string>;
  inStockOnly?: boolean;
  semanticTerms: string[];
  contentTokens: string[];
  sort?: 'price_asc' | 'price_desc' | 'relevance' | 'newest';
  page: number;
  pageSize: number;
  referencedOrdinal?: number;
  referencedColor?: string;
  referencedPronoun?: boolean;
}

export class LocalCommerceProvider {
  /**
   * Introspects the merchant's catalog at runtime to extract dynamic categories,
   * tags, variant attribute keys, and attribute value sets.
   */
  introspectSchema(workspaceId: string): CatalogSchema {
    const products = db.commerce_products.filter(p => p.workspace_id === workspaceId);
    
    const categories = Array.from(new Set(products.map(p => p.category?.trim()).filter(Boolean)));
    const tags = Array.from(new Set(products.flatMap(p => (p.tags || []).map(t => t?.trim().toLowerCase())).filter(Boolean)));
    
    const attributeKeysSet = new Set<string>();
    const attributeValuesMap: Record<string, Set<string>> = {};
    const brandsSet = new Set<string>();

    let minPrice = Infinity;
    let maxPrice = 0;
    let currency = 'INR';

    for (const p of products) {
      if (typeof p.price === 'number') {
        if (p.price < minPrice) minPrice = p.price;
        if (p.price > maxPrice) maxPrice = p.price;
      }
      if (p.currency) currency = p.currency;

      for (const v of (p.variants || [])) {
        if (v.attributes && typeof v.attributes === 'object') {
          for (const [k, val] of Object.entries(v.attributes)) {
            const keyLower = k.toLowerCase().trim();
            const valLower = String(val).toLowerCase().trim();
            if (!keyLower || !valLower) continue;

            attributeKeysSet.add(keyLower);
            if (!attributeValuesMap[keyLower]) {
              attributeValuesMap[keyLower] = new Set<string>();
            }
            attributeValuesMap[keyLower].add(valLower);

            if (keyLower === 'brand') {
              brandsSet.add(valLower);
            }
          }
        }
      }
    }

    const attributeValues: Record<string, string[]> = {};
    for (const [k, vSet] of Object.entries(attributeValuesMap)) {
      attributeValues[k] = Array.from(vSet);
    }

    return {
      categories,
      tags,
      attributeKeys: Array.from(attributeKeysSet),
      attributeValues,
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice,
        currency
      },
      brands: Array.from(brandsSet)
    };
  }

  /**
   * Universal word stemmer for English natural language.
   */
  stemWord(word: string): string {
    const w = word.toLowerCase().trim();
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('es') && !w.endsWith('ses') && w.length > 3) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 2) return w.slice(0, -1);
    return w;
  }

  /**
   * Generic natural-language intent, constraint, preference & scope parser.
   * Driven strictly by the merchant's introspected catalog schema.
   */
  parseQuery(workspaceId: string, userQuery: string, lastSearchState?: any): ParsedSearchQuery {
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

    let q = userQuery.toLowerCase().trim();
    for (const [typo, fix] of Object.entries(typoMap)) {
      q = q.replace(new RegExp(`\\b${typo}\\b`, 'gi'), fix);
    }

    const cleanQ = q.replace(/[^\w\s\-\/₹$]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryTokens = cleanQ.split(/\s+/).filter(w => w.length > 1);
    const queryStemmed = queryTokens.map(t => this.stemWord(t));

    const schema = this.introspectSchema(workspaceId);

    // 1. High-Level Intent & Scope Detection
    const hasHumanEscalation = /talk to (?:a |an )?(?:human|agent|representative|person|operator)|speak (?:with|to) (?:a )?(?:human|person|representative)|connect me to support/i.test(cleanQ);
    const isComparison = /which (?:one |item |product )?is (?:cheaper|most expensive|better|the best)|compare (?:these|the first and second|the products|them)|difference between/i.test(cleanQ);
    const isInventory = /(?:is (?:this|that|the \w+ one) (?:in stock|available)|do you have (?:this|that|it) in (?:size )?(\w+)|is size (\w+) (?:available|in stock)|stock level|inventory count)/i.test(cleanQ);
    const isCart = /(?:add (?:this|that|it|the (?:first|second|third|\w+) one) to (?:my )?cart|add to (?:my )?cart|add (?:that|this|it)|buy this|checkout|remove (?:this|that|the (?:first|second|\w+) one)|show (?:my )?cart|view (?:my )?cart|what(?:'s| is) in my (?:cart|bag))/i.test(cleanQ);
    const isOrder = /(?:where is my order|track(?:ing)? (?:my )?order|order status|status of order|#\d{4,6})/i.test(cleanQ);
    const isPolicy = /(?:return|refund|exchange|warranty|policy|shipping policy|how many days|shipping time|when will it arrive|shipping cost|payment method|cod|cash on delivery|who are you|about|contact|phone|email|address|location|headquarters|support)/i.test(cleanQ);

    const isPagination = /\b(?:show more|load more|more products|more items|next page|see more|more options)\b/i.test(cleanQ);
    const isAllMatching = /\b(?:show all|all matching|all products|give me all|entire collection|whole collection|full catalog|all of them|everything)\b/i.test(cleanQ);
    const isSimilar = /\b(?:similar|like this|more like this|comparable to|similar to)\b/i.test(cleanQ);
    const isRefinement = /\b(?:only|just|instead|remove filter|clear filter|without)\b/i.test(cleanQ) || (lastSearchState && /^(?:under|below|above|size|in|only)\b/i.test(cleanQ));

    let intent: ParsedSearchQuery['intent'] = 'PRODUCT_SEARCH';
    if (hasHumanEscalation) intent = 'HUMAN_HANDOFF';
    else if (isComparison) intent = 'PRODUCT_COMPARISON';
    else if (isInventory) intent = 'INVENTORY_CHECK';
    else if (isCart) intent = 'CART_ACTION';
    else if (isOrder) intent = 'ORDER_TRACKING';
    else if (isPolicy) intent = 'RETURN_OR_POLICY_INQUIRY';

    let scope: ParsedSearchQuery['scope'] = 'recommendations';
    if (isPagination) scope = 'pagination';
    else if (isAllMatching) scope = 'all_matching';
    else if (isSimilar) scope = 'similar';
    else if (isRefinement) scope = 'refinement';

    // 2. Ordinal & Product Reference Resolution
    let referencedOrdinal: number | undefined;
    if (/\b(?:first|1st|number 1)\b/i.test(cleanQ)) referencedOrdinal = 1;
    else if (/\b(?:second|2nd|number 2)\b/i.test(cleanQ)) referencedOrdinal = 2;
    else if (/\b(?:third|3rd|number 3)\b/i.test(cleanQ)) referencedOrdinal = 3;
    else if (/\b(?:fourth|4th|number 4)\b/i.test(cleanQ)) referencedOrdinal = 4;
    else if (/\b(?:last|last one)\b/i.test(cleanQ)) referencedOrdinal = -1;

    let referencedColor: string | undefined;
    const colorWordMatch = cleanQ.match(/\b(black|white|red|blue|grey|silver|olive|green|yellow|pink|navy|wine|maroon|purple|cream|brown)\b/i);
    if (colorWordMatch) referencedColor = colorWordMatch[1].toLowerCase();

    const referencedPronoun = /\b(?:this|that|it|item|product)\b/i.test(cleanQ);

    // 3. Dynamic Category Matching against Catalog Schema
    let explicitCategory: string | undefined;
    for (const cat of schema.categories) {
      const catNorm = cat.toLowerCase().trim();
      const catStemmed = catNorm.split(/[\s\-_]+/).map(t => this.stemWord(t)).join(' ');
      if (cleanQ.includes(catNorm) || cleanQ.includes(catStemmed)) {
        explicitCategory = cat;
        break;
      }
    }

    if (!explicitCategory) {
      for (const cat of schema.categories) {
        const catNorm = cat.toLowerCase().trim();
        const catStem = this.stemWord(catNorm);

        // Disambiguate compound categories (e.g. "T-Shirts" vs "Shirts")
        const isCompound = /t-?shirt|tee/i.test(catNorm);
        const hasCompoundToken = queryTokens.some(t => /t-?shirt|tee/i.test(t));
        if (isCompound && !hasCompoundToken) continue;
        if (!isCompound && /shirt/i.test(catNorm) && hasCompoundToken) continue;

        if (queryStemmed.includes(catStem) || queryTokens.includes(catNorm)) {
          explicitCategory = cat;
          break;
        }
      }
    }

    // 4. Dynamic Attribute Extraction (Size, Color, Gender, Material, Brand, etc.)
    const attributes: Record<string, string> = {};

    // Price Bounds
    let maxPrice: number | undefined;
    let minPrice: number | undefined;
    const maxPriceMatch = cleanQ.match(/(?:under|below|less than|max|around|budget|up to)\s*(?:₹|\$)?\s*(\d+)/i) || cleanQ.match(/(\d+)\s*(?:k|thousand)\b/i);
    if (maxPriceMatch) {
      maxPrice = maxPriceMatch[0].includes('k') ? parseFloat(maxPriceMatch[1]) * 1000 : parseFloat(maxPriceMatch[1]);
    }

    const minPriceMatch = cleanQ.match(/(?:above|over|more than|min|at least|starting from)\s*(?:₹|\$)?\s*(\d+)/i);
    if (minPriceMatch) {
      minPrice = parseFloat(minPriceMatch[1]);
    }

    // Gender
    let gender: 'men' | 'women' | 'unisex' | 'kids' | undefined;
    if (/\b(women|womens|lady|ladies|female|girl|girls|wife|sister|mother)\b/i.test(cleanQ)) {
      gender = 'women';
    } else if (/\b(men|mens|male|gent|gents|guy|guys|brother|husband|father|him|boy)\b/i.test(cleanQ)) {
      gender = 'men';
    } else if (/\b(kids|kid|child|children|baby|toddler)\b/i.test(cleanQ)) {
      gender = 'kids';
    }

    // Size
    let size: string | undefined;
    const sizeMatch = cleanQ.match(/\bsize\s*(\d+|s|m|l|xl|xxl|xxxl|free\s*size)\b/i) || cleanQ.match(/\b(s|m|l|xl|xxl|xxxl)\s+size\b/i);
    if (sizeMatch) {
      size = sizeMatch[1].toUpperCase().replace(/\s+/g, ' ');
    }

    // Color
    let color: string | undefined = referencedColor;
    if (color) {
      attributes['color'] = color;
    }

    // Dynamic Variant Attributes check
    for (const [attrKey, attrVals] of Object.entries(schema.attributeValues)) {
      for (const val of attrVals) {
        if (cleanQ.includes(val) || queryTokens.includes(val)) {
          attributes[attrKey] = val;
        }
      }
    }

    // In Stock Only
    const inStockOnly = /\b(?:only in stock|available only|in stock|ready to ship)\b/i.test(cleanQ);

    // Sorting
    let sort: ParsedSearchQuery['sort'];
    if (/\b(?:cheaper|cheapest|lowest price|price low to high|affordable|budget)\b/i.test(cleanQ)) {
      sort = 'price_asc';
    } else if (/\b(?:expensive|premium|highest price|price high to low|luxe)\b/i.test(cleanQ)) {
      sort = 'price_desc';
    } else if (/\b(?:new|latest|newest|arrivals|recent)\b/i.test(cleanQ)) {
      sort = 'newest';
    }

    // 5. Semantic Terms & Content Tokens
    const semanticUseCases: Record<string, string[]> = {
      gym: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'breathable', 'jogger', 'tee', 'performance', 'tank', 'athletic', 'workout'],
      fitness: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'breathable', 'jogger', 'tee', 'performance', 'athletic'],
      workout: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'breathable', 'jogger', 'tee', 'performance'],
      sports: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'jogger', 'tee', 'visor', 'balaclava'],
      running: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'jogger', 'tee', 'visor'],
      dinner: ['shirt', 'shacket', 'kurta', 'combo', 'saree', 'palace', 'embroidered', 'corduroy', 'dress', 'elegant', 'black', 'luxe'],
      office: ['shirt', 'corduroy', 'pant', 'anti-ac', 'thermal', 'kurta', 'poplin', 'formal', 'classic', 'cotton', 'clean'],
      work: ['shirt', 'corduroy', 'pant', 'anti-ac', 'thermal', 'kurta', 'poplin', 'formal', 'classic', 'cotton'],
      casual: ['tee', 'tshirt', 'jogger', 'hoodie', 'nosweat', 'shacket', 'jacket', 'cotton', 'relaxed', 'casual', 'denim'],
      weekend: ['relaxed', 'casual', 'cotton', 'jogger', 'tee', 'hoodie', 'comfortable', 'denim'],
      trip: ['jogger', 'jacket', 'hoodie', 'tee', 'visor', 'comfort', 'cotton', 'travel'],
      wedding: ['royal', 'heritage', 'saree', 'kurta', 'combo', 'zari', 'dori', 'mandala', 'embroidered', 'festive', 'silk', 'traditional'],
      festive: ['royal', 'heritage', 'saree', 'kurta', 'combo', 'yellow floral', 'emerald', 'mandala', 'embroidered', 'festive'],
      festival: ['royal', 'heritage', 'saree', 'kurta', 'combo', 'yellow floral', 'emerald', 'mandala', 'embroidered', 'festive'],
      summer: ['sunscreen', 'ice', 'cooling', 'tee', 'nosweat', 'visor', 'balaclava', 'upf50', 'lightweight', 'breathable', 'cotton'],
      winter: ['thermal', 'anti-ac', 'fleece', 'hoodie', 'jacket', 'warm', 'insulation', 'corduroy'],
      brother: ['shirt', 'tee', 'jogger', 'jacket', 'shacket', 'corduroy', 'men'],
      wife: ['saree', 'kurta', 'combo', 'dress', 'women', 'yellow floral', 'emerald'],
      comfortable: ['nosweat', 'poplin', 'thermal', 'jogger', 'tee', 'cotton', 'relaxed', 'breathable', 'comfort'],
      comfort: ['nosweat', 'poplin', 'thermal', 'jogger', 'tee', 'cotton', 'relaxed', 'breathable', 'comfort']
    };

    const semanticTerms = new Set<string>();
    for (const [k, terms] of Object.entries(semanticUseCases)) {
      if (cleanQ.includes(k)) {
        terms.forEach(t => semanticTerms.add(t));
      }
    }

    const stopWords = new Set([
      'show', 'me', 'find', 'look', 'for', 'under', 'below', 'in', 'size', 'with', 'a', 'an', 'the',
      'please', 'can', 'you', 'give', 'what', 'are', 'your', 'any', 'new', 'latest', 'product',
      'products', 'items', 'item', 'catalog', 'collection', 'arrivals', 'arrival', 'good', 'something',
      'nice', 'need', 'want', 'buy', 'recommend', 'would', 'like', 'there', 'have', 'i', 'get', 'to',
      'some', 'of', 'and', 'or', 'is', 'it', 'this', 'that', 'from', 'best', 'top', 'do', 'help', 'choose',
      'more', 'page', 'see', 'load', 'all', 'entire', 'everything', 'give', 'ones', 'only'
    ]);
    const contentTokens = queryTokens.filter(t => !stopWords.has(t) && isNaN(Number(t)));

    // 6. Inherit Previous State on Refinement / Pagination
    let page = 1;
    let pageSize = scope === 'all_matching' ? 12 : 6;

    if (isPagination && lastSearchState) {
      page = (lastSearchState.page || 1) + 1;
      pageSize = lastSearchState.pageSize || pageSize;
      if (!explicitCategory) explicitCategory = lastSearchState.explicitCategory || lastSearchState.category;
      if (!gender) gender = lastSearchState.gender;
      if (!color) color = lastSearchState.color;
      if (maxPrice === undefined) maxPrice = lastSearchState.maxPrice;
      if (minPrice === undefined) minPrice = lastSearchState.minPrice;
      if (!size) size = lastSearchState.size;
      if (!sort) sort = lastSearchState.sort;
    } else if (isRefinement && lastSearchState) {
      if (!explicitCategory) explicitCategory = lastSearchState.explicitCategory || lastSearchState.category;
      if (!gender) gender = lastSearchState.gender;
      if (!color) color = lastSearchState.color;
      if (maxPrice === undefined) maxPrice = lastSearchState.maxPrice;
      if (minPrice === undefined) minPrice = lastSearchState.minPrice;
      if (!size) size = lastSearchState.size;
      if (!sort) sort = lastSearchState.sort;
    }

    return {
      intent,
      scope,
      explicitCategory,
      gender,
      minPrice,
      maxPrice,
      size,
      color,
      attributes,
      inStockOnly,
      semanticTerms: Array.from(semanticTerms),
      contentTokens,
      sort,
      page,
      pageSize,
      referencedOrdinal,
      referencedColor,
      referencedPronoun
    };
  }

  /**
   * Detailed search returning structured candidates, metadata, pagination, and applied constraints.
   */
  async searchProductsDetailed(workspaceId: string, params: ProductSearchParams, lastSearchState?: any): Promise<ProductSearchResult> {
    let list = db.commerce_products.filter(p => p.workspace_id === workspaceId);
    const parsed = params.query ? this.parseQuery(workspaceId, params.query, lastSearchState) : null;

    const explicitCategory = params.category || parsed?.explicitCategory;
    const gender = params.gender || parsed?.gender;
    const minPrice = params.minPrice !== undefined ? params.minPrice : parsed?.minPrice;
    const maxPrice = params.maxPrice !== undefined ? params.maxPrice : parsed?.maxPrice;
    const size = params.size || parsed?.size;
    const color = params.color || parsed?.color;
    const inStockOnly = params.inStockOnly !== undefined ? params.inStockOnly : (parsed?.inStockOnly || false);
    const sort = params.sort || parsed?.sort || 'relevance';
    const page = params.page || parsed?.page || 1;
    const pageSize = params.pageSize || parsed?.pageSize || (parsed?.scope === 'all_matching' ? 12 : 6);

    const contentTokens = parsed?.contentTokens || [];
    const semanticTerms = parsed?.semanticTerms || [];
    const cleanQ = params.query?.toLowerCase().trim() || '';

    // Gate: Check if user requested an explicit product entity that does NOT exist in the catalog
    const nonSemanticTokens = contentTokens.filter(tok => {
      const tokL = tok.toLowerCase();
      return !['gym', 'fitness', 'workout', 'sports', 'running', 'dinner', 'office', 'work', 'casual', 'weekend', 'trip', 'wedding', 'festive', 'festival', 'summer', 'winter', 'brother', 'wife', 'comfortable', 'comfort', 'men', 'mens', 'women', 'womens', 'male', 'female', 'kids', 'boy', 'girl', 'cheap', 'expensive', 'premium', 'luxe', 'affordable', 'new', 'latest'].includes(tokL);
    });

    if (nonSemanticTokens.length > 0 && !explicitCategory) {
      const catalogHasToken = list.some(p => {
        const pText = `${p.title} ${p.category} ${(p.tags || []).join(' ')}`.toLowerCase();
        return nonSemanticTokens.some(tok => {
          const tokStem = this.stemWord(tok);
          return pText.includes(tok) || pText.split(/\s+/).some(w => this.stemWord(w) === tokStem);
        });
      });

      if (!catalogHasToken) {
        return {
          products: [],
          totalMatches: 0,
          page,
          pageSize,
          hasMore: false,
          appliedConstraints: { category: explicitCategory, gender, minPrice, maxPrice, size, color, inStockOnly, sort, page, pageSize },
          categoriesMatched: []
        };
      }
    }

    const checkIsWomenProduct = (p: CommerceProduct) => {
      const titleL = p.title.toLowerCase();
      const tagsL = (p.tags || []).map(t => t.toLowerCase()).join(' ');
      const catL = (p.category || '').toLowerCase();
      const descL = (p.description || '').toLowerCase();
      const full = `${titleL} ${tagsL} ${catL} ${descL}`;
      return full.includes('women') || full.includes('womens') || full.includes('female') ||
        full.includes('saree') || full.includes('kurta') || full.includes('kurti') ||
        full.includes('dress') || full.includes('lehenga') || full.includes('gown') ||
        full.includes('skirt') || full.includes('blouse');
    };

    const isMenQuery = gender === 'men';
    const isWomenQuery = gender === 'women';

    // 1. Candidate Filtering
    let candidates = list.filter(p => {
      const titleL = p.title.toLowerCase();
      const tagsL = (p.tags || []).map(t => t.toLowerCase());
      const catL = (p.category || '').toLowerCase();
      const descL = (p.description || '').toLowerCase();
      const fullText = `${titleL} ${descL} ${catL} ${tagsL.join(' ')}`;

      // Demographic constraint
      const isWomen = checkIsWomenProduct(p);
      if (isMenQuery && !isWomenQuery && isWomen && !fullText.includes('men') && !fullText.includes('couple')) {
        return false;
      }
      if (isWomenQuery && !isMenQuery && !isWomen) {
        return false;
      }

      // Explicit Category constraint
      if (explicitCategory) {
        const expCatL = explicitCategory.toLowerCase().trim();
        const expCatStem = this.stemWord(expCatL);

        const isCategoryExact = catL === expCatL;
        const isCategoryStemmed = this.stemWord(catL) === expCatStem;
        const isTitleExact = titleL.includes(expCatL) || titleL.split(/\s+/).map(t => this.stemWord(t)).includes(expCatStem);
        const isTagExact = tagsL.includes(expCatL) || tagsL.map(t => this.stemWord(t)).includes(expCatStem);

        if (!isCategoryExact && !isCategoryStemmed && !isTitleExact && !isTagExact) {
          return false;
        }
      }

      // Price constraints
      if (minPrice !== undefined && p.price < minPrice) return false;
      if (maxPrice !== undefined && p.price > maxPrice) return false;

      // In Stock constraint
      if (inStockOnly && (!p.in_stock || p.total_inventory <= 0)) return false;

      // Size constraint
      if (size) {
        const sizeL = size.toLowerCase();
        const hasSize = p.variants.some(v => v.attributes.size?.toLowerCase() === sizeL && v.inventory_quantity > 0);
        if (!hasSize) return false;
      }

      // Color constraint
      if (color) {
        const colorL = color.toLowerCase();
        const colorSynonyms: Record<string, string[]> = {
          red: ['red', 'wine', 'maroon', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'coral'],
          blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky'],
          green: ['green', 'emerald', 'olive', 'mint', 'sage', 'evergreen', 'forest'],
          black: ['black', 'stealth', 'charcoal', 'jet', 'dark', 'obsidian'],
          white: ['white', 'off-white', 'off white', 'ivory', 'cream'],
          yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon'],
          brown: ['brown', 'coffee', 'tan', 'khaki', 'mocha']
        };
        const colorFamily = [colorL, ...(colorSynonyms[colorL] || [])];
        const hasColorInText = colorFamily.some(c => fullText.includes(c));
        const hasColorInVariant = p.variants.some(v => {
          const vColor = `${v.attributes.color || ''} ${v.title || ''}`.toLowerCase();
          return colorFamily.some(c => vColor.includes(c));
        });
        if (!hasColorInText && !hasColorInVariant) return false;
      }

      return true;
    });

    // 2. Multi-Signal Hybrid Scoring & Relevance Filtering
    const computeRelevance = (p: CommerceProduct) => {
      let s = 0;
      const tLower = p.title.toLowerCase();
      const dLower = (p.description || '').toLowerCase();
      const catLower = (p.category || '').toLowerCase();
      const tagsLower = (p.tags || []).map(t => t.toLowerCase());

      if (explicitCategory) {
        const expL = explicitCategory.toLowerCase();
        if (catLower === expL) s += 250;
        else if (this.stemWord(catLower) === this.stemWord(expL)) s += 200;
        if (tLower.includes(expL)) s += 150;
      }

      if (cleanQ && tLower.includes(cleanQ)) s += 120;

      for (const token of contentTokens) {
        const tokenStem = this.stemWord(token);
        if (tLower.includes(token)) s += 60;
        else if (this.stemWord(tLower).includes(tokenStem)) s += 40;

        if (tagsLower.includes(token)) s += 30;
        if (catLower.includes(token)) s += 25;
        if (dLower.includes(token)) s += 15;
      }

      for (const semTerm of semanticTerms) {
        if (tLower.includes(semTerm)) s += 35;
        if (tagsLower.includes(semTerm)) s += 25;
        if (dLower.includes(semTerm)) s += 15;
      }

      return s;
    };

    const hasSpecificSearchTerms = contentTokens.length > 0 || explicitCategory !== undefined || semanticTerms.length > 0;
    if (hasSpecificSearchTerms) {
      candidates = candidates.filter(p => computeRelevance(p) > 0);
    }

    // 3. Sorting & Deduplication
    candidates.sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'newest') {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      }

      const scoreA = computeRelevance(a) + (a.in_stock && a.total_inventory > 0 ? 20 : 0);
      const scoreB = computeRelevance(b) + (b.in_stock && b.total_inventory > 0 ? 20 : 0);
      return scoreB - scoreA;
    });

    const seenTitles = new Set<string>();
    const deduplicated: CommerceProduct[] = [];
    for (const p of candidates) {
      const norm = p.title.trim().toLowerCase();
      if (!seenTitles.has(norm)) {
        seenTitles.add(norm);
        deduplicated.push(p);
      }
    }

    // 4. Pagination
    const totalMatches = deduplicated.length;
    const startIndex = (page - 1) * pageSize;
    const pagedProducts = deduplicated.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < totalMatches;

    const appliedConstraints: Record<string, any> = {
      category: explicitCategory,
      gender,
      minPrice,
      maxPrice,
      size,
      color,
      inStockOnly,
      sort,
      page,
      pageSize
    };

    return {
      products: pagedProducts,
      totalMatches,
      page,
      pageSize,
      hasMore,
      appliedConstraints,
      categoriesMatched: explicitCategory ? [explicitCategory] : []
    };
  }

  /**
   * High-level search returning simple list of products for backwards-compatibility.
   */
  async searchProducts(workspaceId: string, params: ProductSearchParams): Promise<CommerceProduct[]> {
    const detailed = await this.searchProductsDetailed(workspaceId, params);
    return detailed.products;
  }

  async compareProducts(workspaceId: string, productIds: string[]): Promise<{
    products: CommerceProduct[];
    cheapest: CommerceProduct | null;
    mostExpensive: CommerceProduct | null;
    comparisonPoints: string[];
  }> {
    const products = db.commerce_products.filter(
      p => p.workspace_id === workspaceId && productIds.includes(p.id)
    );

    if (products.length === 0) {
      return { products: [], cheapest: null, mostExpensive: null, comparisonPoints: [] };
    }

    const sortedByPrice = [...products].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    const mostExpensive = sortedByPrice[sortedByPrice.length - 1];

    const comparisonPoints = products.map(p => 
      `• **${p.title}**: ₹${p.price.toLocaleString('en-IN')}${p.compare_at_price ? ` (MRP ₹${p.compare_at_price.toLocaleString('en-IN')})` : ''} — ${p.category} (${p.in_stock ? 'In Stock' : 'Out of Stock'})`
    );

    return {
      products,
      cheapest,
      mostExpensive,
      comparisonPoints
    };
  }

  async removeFromCart(workspaceId: string, cartId: string, productId: string, variantId?: string): Promise<CommerceCart> {
    const cart = await this.getCart(workspaceId, cartId);
    cart.items = cart.items.filter(
      i => !(i.product_id === productId && (!variantId || i.variant_id === variantId))
    );
    cart.subtotal = cart.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    cart.total = Math.max(0, cart.subtotal - cart.discount_amount);
    cart.updated_at = new Date().toISOString();
    db.scheduleSave();
    return cart;
  }

  async getProduct(workspaceId: string, productId: string): Promise<CommerceProduct | null> {
    return db.commerce_products.find(p => p.workspace_id === workspaceId && p.id === productId) || null;
  }

  async getInventory(workspaceId: string, productId: string, variantId?: string): Promise<{
    in_stock: boolean;
    available_quantity: number;
    variants: Array<{ id: string; title: string; quantity: number }>;
  }> {
    const product = await this.getProduct(workspaceId, productId);
    if (!product) {
      return { in_stock: false, available_quantity: 0, variants: [] };
    }

    if (variantId) {
      const v = product.variants.find(item => item.id === variantId || item.attributes.size === variantId);
      if (v) {
        return {
          in_stock: v.inventory_quantity > 0,
          available_quantity: v.inventory_quantity,
          variants: [{ id: v.id, title: v.title, quantity: v.inventory_quantity }]
        };
      }
    }

    return {
      in_stock: product.in_stock && product.total_inventory > 0,
      available_quantity: product.total_inventory,
      variants: product.variants.map(v => ({ id: v.id, title: v.title, quantity: v.inventory_quantity }))
    };
  }

  maskAddress(address?: string): string {
    if (!address) return 'Address on file';
    const parts = address.split(',');
    if (parts.length > 1) {
      return `*** ${parts[0].slice(-7)}, ${parts.slice(1).join(',').trim()}`;
    }
    return `*** ${address.slice(-10)}`;
  }

  async getOrder(workspaceId: string, orderNumber: string, customerEmail?: string): Promise<CommerceOrder | null> {
    if (!customerEmail || !customerEmail.trim()) {
      return null;
    }
    const cleanNum = orderNumber.replace('#', '').trim();
    const cleanEmail = customerEmail.toLowerCase().trim();

    const order = db.commerce_orders.find(o =>
      o.workspace_id === workspaceId &&
      (o.order_number?.replace('#', '') === cleanNum || o.id === orderNumber) &&
      o.customer_email?.toLowerCase().trim() === cleanEmail
    );
    return order || null;
  }

  async getShippingStatus(workspaceId: string, orderNumber: string, customerEmail?: string) {
    if (!customerEmail || !customerEmail.trim()) {
      return null;
    }
    const order = await this.getOrder(workspaceId, orderNumber, customerEmail);
    if (!order) return null;

    let trackingUrl = '';
    if (order.carrier?.includes('FedEx')) {
      trackingUrl = 'https://www.fedex.com/fedextrack/?trknbr=' + order.tracking_number;
    } else if (order.carrier?.includes('UPS')) {
      trackingUrl = 'https://www.ups.com/track?tracknum=' + order.tracking_number;
    }

    return {
      order_number: order.order_number,
      status: order.status,
      carrier: order.carrier,
      tracking_number: order.tracking_number,
      tracking_url: trackingUrl,
      masked_destination: this.maskAddress(order.shipping_address),
      estimated_delivery: order.status === 'DELIVERED' ? 'Delivered on time' : 'Estimated within 2 business days'
    };
  }

  async getCart(workspaceId: string, cartId: string): Promise<CommerceCart> {
    let cart = db.commerce_carts.find(c => c.workspace_id === workspaceId && c.id === cartId);
    if (!cart) {
      cart = {
        id: cartId,
        workspace_id: workspaceId,
        items: [],
        discount_amount: 0,
        subtotal: 0,
        total: 0,
        currency: 'USD',
        updated_at: new Date().toISOString()
      };
      db.commerce_carts.push(cart);
      db.scheduleSave();
    }
    return cart;
  }

  async addToCart(workspaceId: string, cartId: string, item: {
    productId: string;
    variantId?: string;
    quantity: number;
  }): Promise<CommerceCart> {
    const cart = await this.getCart(workspaceId, cartId);
    const product = await this.getProduct(workspaceId, item.productId);
    if (!product) throw new Error('Product not found');

    const variant = product.variants.find(v => v.id === item.variantId) || product.variants[0];
    const price = variant ? variant.price : product.price;

    const existingIndex = cart.items.findIndex(
      i => i.product_id === item.productId && (!item.variantId || i.variant_id === item.variantId)
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += (item.quantity || 1);
    } else {
      cart.items.push({
        product_id: product.id,
        variant_id: variant?.id,
        title: product.title + (variant ? ' (' + variant.title + ')' : ''),
        quantity: item.quantity || 1,
        price: price,
        image: product.images[0]
      });
    }

    cart.subtotal = cart.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    cart.total = Math.max(0, cart.subtotal - cart.discount_amount);
    cart.updated_at = new Date().toISOString();

    db.scheduleSave();
    return cart;
  }

  async validateCoupon(workspaceId: string, code: string, subtotal: number) {
    const upper = code.toUpperCase().trim();
    if (upper === 'WELCOME10') {
      const discount = subtotal * 0.10;
      return { valid: true, discount_amount: discount, description: '10% New Customer Discount' };
    }
    if (upper === 'VIP20') {
      const discount = subtotal * 0.20;
      return { valid: true, discount_amount: discount, description: '20% VIP Store Discount' };
    }
    if (upper === 'FREESHIP') {
      return { valid: true, discount_amount: 5.99, description: 'Free Standard Shipping Applied' };
    }
    return { valid: false, discount_amount: 0, description: 'Invalid or expired promotional code' };
  }

  async checkReturnEligibility(workspaceId: string, orderNumber: string, productId?: string, customerEmail?: string) {
    const cleanNum = orderNumber.replace('#', '').trim();
    const order = db.commerce_orders.find(o =>
      o.workspace_id === workspaceId &&
      (o.order_number.replace('#', '') === cleanNum || o.id === orderNumber) &&
      (!customerEmail || o.customer_email.toLowerCase().trim() === customerEmail.toLowerCase().trim())
    );
    if (!order) return { eligible: false, reason: 'Order not found', return_window_days: 0 };

    if (order.status !== 'DELIVERED') {
      return { eligible: false, reason: 'Order is not marked delivered yet', return_window_days: 0 };
    }

    return {
      eligible: true,
      reason: 'Eligible for standard 7-day exchange/return with prepaid courier pickup',
      return_window_days: 7
    };
  }

  async createReturn(workspaceId: string, orderNumber: string, productId: string, reason: string) {
    const returnId = 'RET-' + Date.now().toString().slice(-6);
    return {
      success: true,
      return_id: returnId,
      return_label_url: 'https://returns.bluetyga.com/labels/' + returnId + '.pdf',
      instructions: 'Keep the item in its original packaging with tags attached. A Bluedart/Delhivery courier executive will arrive for doorstep reverse pickup.'
    };
  }
}

export const commerceEngine = new LocalCommerceProvider();
