import { AIModeSearchPlan, SearchConstraint } from '../types';
import { CatalogSchemaSnapshot } from './catalog-introspector';

const GENERAL_STOP_WORDS = new Set([
  'product', 'products', 'item', 'items', 'show', 'me', 'find', 'get', 'give',
  'all', 'the', 'a', 'an', 'in', 'for', 'of', 'to', 'with', 'and', 'or', 'some',
  'please', 'looking', 'look', 'want', 'need', 'buy', 'shop', 'display', 'list',
  'available', 'good', 'best', 'top', 'any', 'have', 'you', 'can', 'is', 'are',
  'rupee', 'rupees', 'rs', 'inr', 'buck', 'bucks', 'price', 'cost', 'budget',
  'around', 'approx', 'rate', 'rates', 'worth', 'value', 'under', 'below', 'above',
  'which', 'that', 'this', 'ones', 'only', 'from', 'between', 'upto', 'less', 'more', 'than',
  'colour', 'color', 'colors', 'colours', 'shade', 'shades', 'type', 'types'
]);

const SOFT_PREFERENCE_VOCABULARY = new Set([
  'casual', 'formal', 'elegant', 'stylish', 'modern', 'vintage', 'classic', 'chic',
  'party', 'wedding', 'festive', 'festival', 'office', 'work', 'workplace', 'daily',
  'daily wear', 'summer', 'winter', 'autumn', 'spring', 'monsoon', 'vacation', 'holiday',
  'trip', 'travel', 'comfortable', 'comfort', 'luxury', 'premium', 'minimalist', 'bold',
  'trendy', 'popular', 'latest', 'lightweight', 'breathable', 'durable', 'cozy', 'warm',
  'active', 'gym', 'workout', 'fitness', 'sporty', 'night', 'dinner', 'date', 'simple',
  'fancy', 'traditional', 'ethnic', 'contemporary', 'designer', 'affordable', 'budget-friendly'
]);

const DEMOGRAPHIC_ALIASES: Record<string, string> = {
  'men': 'men',
  'man': 'men',
  'mens': 'men',
  "men's": 'men',
  'male': 'men',
  'gents': 'men',
  'gent': 'men',
  'boys': 'men',
  'boy': 'men',
  'him': 'men',
  'brother': 'men',
  'husband': 'men',
  'father': 'men',
  'women': 'women',
  'woman': 'women',
  'womens': 'women',
  "women's": 'women',
  'female': 'women',
  'ladies': 'women',
  'lady': 'women',
  'girls': 'women',
  'girl': 'women',
  'her': 'women',
  'wife': 'women',
  'sister': 'women',
  'mother': 'women',
  'kids': 'kids',
  'kid': 'kids',
  'children': 'kids',
  'child': 'kids',
  'baby': 'kids',
  'toddler': 'kids',
  'unisex': 'unisex',
  'couple': 'unisex',
  'couples': 'unisex'
};

const STANDARD_COLORS = [
  'navy blue', 'dark blue', 'royal blue', 'sky blue', 'light blue', 'blue',
  'dark green', 'olive green', 'mint green', 'forest green', 'emerald green', 'sage green', 'green',
  'dark red', 'wine', 'maroon', 'burgundy', 'crimson', 'ruby', 'rust', 'cherry', 'coral', 'scarlet', 'red',
  'jet black', 'pitch black', 'stealth black', 'black',
  'off white', 'off-white', 'ivory', 'cream', 'pure white', 'white',
  'mustard yellow', 'lemon yellow', 'golden yellow', 'gold', 'yellow',
  'coffee brown', 'dark brown', 'chocolate brown', 'khaki', 'tan', 'beige', 'camel', 'mocha', 'brown',
  'dark purple', 'lavender', 'lilac', 'plum', 'violet', 'magenta', 'mauve', 'purple',
  'baby pink', 'dusty pink', 'rose pink', 'blush pink', 'salmon pink', 'peach', 'fuchsia', 'pink',
  'silver', 'charcoal', 'slate', 'ash', 'grey', 'gray', 'orange', 'teal', 'turquoise', 'indigo', 'cyan'
];

const STANDARD_MATERIALS = [
  'cotton', 'linen', 'silk', 'denim', 'leather', 'wool', 'corduroy', 'fleece',
  'nylon', 'polyester', 'satin', 'chiffon', 'velvet', 'georgette', 'khadi',
  'rayon', 'modal', 'canvas', 'spandex', 'elastane', 'twill', 'suede'
];

export class QueryUnderstandingEngine {
  /**
   * Universal natural language query understanding with dynamic constraint extraction,
   * hard vs soft requirement distinction, and conversational context support.
   */
  public static parse(
    rawQuery: string,
    schema?: CatalogSchemaSnapshot,
    previousState?: AIModeSearchPlan
  ): AIModeSearchPlan {
    const queryClean = rawQuery.trim();
    const queryLower = queryClean.toLowerCase();

    // -------------------------------------------------------------
    // 1. Intent Classification
    // -------------------------------------------------------------
    let intent: AIModeSearchPlan['intent'] = 'DISCOVERY';
    if (/\b(compare|which\s+is\s+better|difference\s+between|vs|recommend\s+between)\b/i.test(queryLower)) {
      intent = 'COMPARISON';
    } else if (/\b(recommend|suggest|what\s+should\s+i\s+(?:buy|get)|best\s+for|outfit\s+for)\b/i.test(queryLower)) {
      intent = 'RECOMMENDATION';
    } else if (/\b(similar|like\s+this|more\s+like|alternative\s+to)\b/i.test(queryLower)) {
      intent = 'SIMILAR';
    } else if (/\b(in\s+stock|available|inventory|check\s+stock)\b/i.test(queryLower)) {
      intent = 'INVENTORY';
    } else if (previousState && /\b(cheaper|expensive|only|change\s+to|filter|in\s+black|in\s+red|under|above|size|brand)\b/i.test(queryLower)) {
      intent = 'REFINEMENT';
    }

    const hardConstraints: SearchConstraint[] = [];
    const softPreferences: string[] = [];
    const exclusions: string[] = [];
    const productConcepts: string[] = [];
    let extractedCategory: string | undefined;
    let extractedProductType: string | undefined;
    let extractedBrand: string | undefined;
    let extractedColor: string | undefined;
    let extractedSize: string | undefined;
    let extractedGender: string | undefined;
    let extractedMaterial: string | undefined;
    let extractedMinPrice: number | undefined;
    let extractedMaxPrice: number | undefined;
    let inStockOnly: boolean | undefined;
    const customAttributes: Record<string, string> = {};

    // -------------------------------------------------------------
    // 2. Negative Constraints & Exclusions ("not leather", "without sleeves", "exclude red", "no black")
    // -------------------------------------------------------------
    const exclusionRegex = /\b(?:not|without|no|exclude|except|non-?)\s+([a-z0-9\-_]+)\b/gi;
    let exclMatch;
    while ((exclMatch = exclusionRegex.exec(queryLower)) !== null) {
      const term = exclMatch[1].trim();
      if (term && !GENERAL_STOP_WORDS.has(term)) {
        exclusions.push(term);
        hardConstraints.push({
          field: 'all',
          operator: 'NOT_IN',
          value: term,
          normalized_value: term,
          is_hard: true,
          is_variant_level: false,
          confidence: 0.95,
          source: 'explicit',
          raw_token: exclMatch[0]
        });
      }
    }

    const isExcluded = (term: string) => {
      const t = term.toLowerCase().trim();
      return exclusions.some(e => e === t || t.includes(e) || e.includes(t)) ||
             new RegExp(`\\b(?:not|without|no|exclude|except|non-?)\\s+${escapeRegex(t)}\\b`, 'i').test(queryLower);
    };

    // -------------------------------------------------------------
    // 3. Numeric Price & Range Constraints
    // -------------------------------------------------------------
    // Range: "between 1000 and 2000", "from 500 to 1500", "1000 - 2000", "1000 to 2500"
    const rangeMatch = queryLower.match(/(?:between|from)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)\s*(?:to|-|and)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)/i) ||
                       queryLower.match(/(\d+(?:,\d+)?)\s*(?:-|to)\s*(\d+(?:,\d+)?)\s*(?:rs\.?|inr|rupees?|bucks?|₹|\$)/i);
    if (rangeMatch) {
      extractedMinPrice = parseFloat(rangeMatch[1].replace(/,/g, ''));
      extractedMaxPrice = parseFloat(rangeMatch[2].replace(/,/g, ''));
    }

    // Upper bound: "under 2000", "below 1500", "less than 2000", "max 3000", "budget 2500", "up to 2000", "within 2000"
    if (extractedMaxPrice === undefined) {
      const underMatch = queryLower.match(/(?:under|below|less\s+than|max(?:imum)?|budget|within|upto|up\s+to)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)/i) ||
                         queryLower.match(/(\d+)\s*(?:k|thousand)\s*(?:budget|max|under)?\b/i);
      if (underMatch) {
        extractedMaxPrice = underMatch[0].includes('k') ? parseFloat(underMatch[1]) * 1000 : parseFloat(underMatch[1].replace(/,/g, ''));
      }
    }

    // Lower bound: "above 500", "over 1000", "more than 500", "min 500", "starting from 1000", "at least 500"
    if (extractedMinPrice === undefined) {
      const aboveMatch = queryLower.match(/(?:above|over|more\s+than|min(?:imum)?|from|starting\s+at|at\s+least)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)/i);
      if (aboveMatch) {
        extractedMinPrice = parseFloat(aboveMatch[1].replace(/,/g, ''));
      }
    }

    // Direct currency / standalone budget: "1000 rupees", "1000 rs", "1000 inr", "₹1000", "$50", "product 1000"
    if (extractedMaxPrice === undefined && extractedMinPrice === undefined) {
      const directCurrencyMatch = queryLower.match(/(\d+(?:,\d+)?)\s*(?:rs\.?|inr|rupees?|bucks?|₹|\$)/i) ||
                                  queryLower.match(/(?:rs\.?|inr|₹|\$)\s*(\d+(?:,\d+)?)/i) ||
                                  queryLower.match(/(?:product|products|item|items|price|cost|budget|around|approx)\s+(\d{2,6})\b/i);
      if (directCurrencyMatch) {
        extractedMaxPrice = parseFloat(directCurrencyMatch[1].replace(/,/g, ''));
      }
    }

    if (extractedMaxPrice !== undefined && extractedMinPrice !== undefined) {
      hardConstraints.push({
        field: 'price',
        operator: 'BETWEEN',
        value: [extractedMinPrice, extractedMaxPrice],
        normalized_value: [extractedMinPrice, extractedMaxPrice],
        is_hard: true,
        is_variant_level: true,
        confidence: 0.98,
        source: 'explicit'
      });
    } else {
      if (extractedMaxPrice !== undefined) {
        hardConstraints.push({
          field: 'price',
          operator: '<=',
          value: extractedMaxPrice,
          normalized_value: extractedMaxPrice,
          is_hard: true,
          is_variant_level: true,
          confidence: 0.98,
          source: 'explicit'
        });
      }
      if (extractedMinPrice !== undefined) {
        hardConstraints.push({
          field: 'price',
          operator: '>=',
          value: extractedMinPrice,
          normalized_value: extractedMinPrice,
          is_hard: true,
          is_variant_level: true,
          confidence: 0.98,
          source: 'explicit'
        });
      }
    }

    // -------------------------------------------------------------
    // 4. Availability Constraint ("in stock", "available only")
    // -------------------------------------------------------------
    if (/\b(in\s+stock|available(?:\s+only)?|ready\s+to\s+ship|immediate\s+dispatch)\b/i.test(queryLower)) {
      inStockOnly = true;
      hardConstraints.push({
        field: 'in_stock',
        operator: '=',
        value: true,
        normalized_value: true,
        is_hard: true,
        is_variant_level: true,
        confidence: 0.95,
        source: 'explicit'
      });
    }

    // -------------------------------------------------------------
    // 5. Gender / Demographic Audience Constraint
    // -------------------------------------------------------------
    for (const [alias, normalizedGender] of Object.entries(DEMOGRAPHIC_ALIASES)) {
      const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
      if (aliasRegex.test(queryLower) && !isExcluded(alias)) {
        extractedGender = normalizedGender;
        hardConstraints.push({
          field: 'audience',
          operator: '=',
          value: normalizedGender,
          normalized_value: normalizedGender,
          is_hard: true,
          is_variant_level: false,
          confidence: 0.95,
          source: 'explicit',
          raw_token: alias
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 6. Explicit Color Extraction (Single & Compound Colors, Color Phrases)
    // -------------------------------------------------------------
    for (const colorCandidate of STANDARD_COLORS) {
      if (isExcluded(colorCandidate)) continue;
      const colorRegex = new RegExp(`\\b(?:in\\s+|color:?\\s*|colour:?\\s*)?${escapeRegex(colorCandidate)}(?:\\s+colou?r)?\\b`, 'i');
      if (colorRegex.test(queryLower)) {
        extractedColor = colorCandidate;
        hardConstraints.push({
          field: 'color',
          operator: '=',
          value: colorCandidate,
          normalized_value: colorCandidate,
          is_hard: true,
          is_variant_level: true,
          confidence: 0.96,
          source: 'explicit',
          raw_token: colorCandidate
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 7. Explicit Material Extraction
    // -------------------------------------------------------------
    for (const matCandidate of STANDARD_MATERIALS) {
      if (isExcluded(matCandidate)) continue;
      const matRegex = new RegExp(`\\b(?:made\\s+of\\s+|in\\s+|pure\\s+)?${escapeRegex(matCandidate)}(?:\\s+fabric|\\s+material)?\\b`, 'i');
      if (matRegex.test(queryLower)) {
        extractedMaterial = matCandidate;
        hardConstraints.push({
          field: 'material',
          operator: '=',
          value: matCandidate,
          normalized_value: matCandidate,
          is_hard: true,
          is_variant_level: true,
          confidence: 0.95,
          source: 'explicit',
          raw_token: matCandidate
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 8. Explicit Size Extraction (e.g. "size M", "size 32", "size 9", "M size", "XL size", "Blue M shirt")
    // -------------------------------------------------------------
    const sizeMatch = queryLower.match(/\bsize\s*([0-9a-z\-_]+)\b/i) || 
                      queryLower.match(/\b(xxxl|xxl|xl|xs|[smlx])\s+size\b/i) ||
                      queryLower.match(/\b(free\s*size)\b/i) ||
                      queryLower.match(/\b([0-9]{2})\s+size\b/i) ||
                      queryLower.match(/\b(xxxl|xxl|xl|xs|[smlx])\b/i);
    if (sizeMatch && !isExcluded(sizeMatch[1].toLowerCase())) {
      extractedSize = sizeMatch[1].toUpperCase().trim();
      hardConstraints.push({
        field: 'size',
        operator: '=',
        value: extractedSize,
        normalized_value: extractedSize,
        is_hard: true,
        is_variant_level: true,
        confidence: 0.95,
        source: 'explicit',
        raw_token: sizeMatch[0]
      });
    }

    // -------------------------------------------------------------
    // 9. Catalog Schema Driven Introspection (Categories, Brands, Custom Attributes)
    // -------------------------------------------------------------
    if (schema) {
      // Check Brand
      for (const brand of schema.brands) {
        const brandNorm = brand.toLowerCase().trim();
        if (isExcluded(brandNorm)) continue;
        const brandRegex = new RegExp(`\\b${escapeRegex(brandNorm)}\\b`, 'i');
        if (brandRegex.test(queryLower)) {
          extractedBrand = brand;
          hardConstraints.push({
            field: 'brand',
            operator: '=',
            value: brand,
            normalized_value: brand,
            is_hard: true,
            is_variant_level: false,
            confidence: 0.98,
            source: 'explicit',
            raw_token: brand
          });
          break;
        }
      }

      // Check Categories & Product Types
      const hasTshirt = /\b(?:t-?shirts?|tees?)\b/i.test(queryLower);
      let catMatched = false;

      for (const cat of schema.categories) {
        const catNorm = cat.toLowerCase().trim();
        if (isExcluded(catNorm)) continue;
        const isCompoundCat = /t-?shirt|tee/i.test(catNorm);

        if (isCompoundCat && hasTshirt) {
          extractedCategory = cat;
          productConcepts.push(cat);
          hardConstraints.push({
            field: 'category',
            operator: '=',
            value: cat,
            normalized_value: cat,
            is_hard: true,
            is_variant_level: false,
            confidence: 0.95,
            source: 'explicit',
            raw_token: cat
          });
          catMatched = true;
          break;
        }
      }

      if (!catMatched) {
        for (const cat of schema.categories) {
          const catNorm = cat.toLowerCase().trim();
          if (isExcluded(catNorm)) continue;
          if (/shirt/i.test(catNorm) && hasTshirt) continue; // Don't match generic "Shirt" if query asks for "T-Shirt"

          const catRegex = new RegExp(`\\b${escapeRegex(catNorm)}s?\\b`, 'i');
          if (catRegex.test(queryLower)) {
            extractedCategory = cat;
            productConcepts.push(cat);
            hardConstraints.push({
              field: 'category',
              operator: '=',
              value: cat,
              normalized_value: cat,
              is_hard: true,
              is_variant_level: false,
              confidence: 0.92,
              source: 'explicit',
              raw_token: cat
            });
            catMatched = true;
            break;
          }
        }
      }

      // Introspect Discovered Dynamic Attributes across merchant catalog
      for (const [attrKey, attrValueSet] of schema.attributeValues.entries()) {
        if (['category', 'product_type', 'brand', 'price'].includes(attrKey)) continue;

        for (const attrVal of attrValueSet) {
          const valNorm = attrVal.toLowerCase().trim();
          if (valNorm.length < 2 || GENERAL_STOP_WORDS.has(valNorm) || isExcluded(valNorm)) continue;

          const valRegex = new RegExp(`\\b${escapeRegex(valNorm)}\\b`, 'i');
          if (valRegex.test(queryLower)) {
            if (attrKey.includes('color') || isColorToken(valNorm)) {
              if (!extractedColor) {
                extractedColor = attrVal;
                hardConstraints.push({
                  field: 'color',
                  operator: '=',
                  value: attrVal,
                  normalized_value: attrVal,
                  is_hard: true,
                  is_variant_level: true,
                  confidence: 0.95,
                  source: 'explicit',
                  raw_token: attrVal
                });
              }
            } else if (attrKey.includes('size') || isSizeToken(valNorm)) {
              if (!extractedSize) {
                extractedSize = attrVal;
                hardConstraints.push({
                  field: 'size',
                  operator: '=',
                  value: attrVal,
                  normalized_value: attrVal,
                  is_hard: true,
                  is_variant_level: true,
                  confidence: 0.95,
                  source: 'explicit',
                  raw_token: attrVal
                });
              }
            } else if (attrKey.includes('material')) {
              if (!extractedMaterial) {
                extractedMaterial = attrVal;
                hardConstraints.push({
                  field: 'material',
                  operator: '=',
                  value: attrVal,
                  normalized_value: attrVal,
                  is_hard: true,
                  is_variant_level: true,
                  confidence: 0.95,
                  source: 'explicit',
                  raw_token: attrVal
                });
              }
            } else {
              if (!customAttributes[attrKey]) {
                customAttributes[attrKey] = attrVal;
                hardConstraints.push({
                  field: attrKey,
                  operator: '=',
                  value: attrVal,
                  normalized_value: attrVal,
                  is_hard: true,
                  is_variant_level: true,
                  confidence: 0.90,
                  source: 'explicit',
                  raw_token: attrVal
                });
              }
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 10. Generic Key-Value Regex Matches ("fit: slim", "storage: 256gb", "sleeve: full")
    // -------------------------------------------------------------
    const kvRegex = /\b([a-z_]{3,15})\s*[:=]\s*([a-z0-9\-_]+)\b/gi;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(queryLower)) !== null) {
      const key = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (!GENERAL_STOP_WORDS.has(key) && !GENERAL_STOP_WORDS.has(val) && !isExcluded(val)) {
        customAttributes[key] = val;
        hardConstraints.push({
          field: key,
          operator: '=',
          value: val,
          normalized_value: val,
          is_hard: true,
          is_variant_level: true,
          confidence: 0.95,
          source: 'explicit',
          raw_token: kvMatch[0]
        });
      }
    }

    // -------------------------------------------------------------
    // 11. Soft Preferences & Stylistic Concepts
    // -------------------------------------------------------------
    const rawTokens = queryLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (const token of rawTokens) {
      if (SOFT_PREFERENCE_VOCABULARY.has(token) && !isExcluded(token)) {
        softPreferences.push(token);
      }
    }

    // -------------------------------------------------------------
    // 12. Semantic & Lexical Query Cleaning
    // -------------------------------------------------------------
    const nonContentTokens = new Set([
      ...GENERAL_STOP_WORDS,
      ...exclusions,
      ...(extractedBrand ? extractedBrand.toLowerCase().split(/\s+/) : []),
      ...(extractedColor ? [extractedColor.toLowerCase()] : []),
      ...(extractedSize ? [extractedSize.toLowerCase()] : []),
      ...(extractedGender ? [extractedGender.toLowerCase()] : [])
    ]);

    const lexicalTokens = rawTokens.filter(t => !nonContentTokens.has(t) && isNaN(Number(t)));
    const lexical_query = lexicalTokens.join(' ');
    
    // Clean semantic query (stripped of exclusion clauses)
    let semantic_query = queryClean;
    if (exclusions.length > 0) {
      semantic_query = semantic_query.replace(/\b(?:not|without|no|exclude|except|non-?)\s+[a-z0-9\-_]+/gi, '').trim();
    }

    // -------------------------------------------------------------
    // 13. Sorting Preferences
    // -------------------------------------------------------------
    let sorting: AIModeSearchPlan['sorting'] = 'relevance';
    if (/\b(cheap|cheaper|lowest\s+price|low\s+to\s+high|price\s+low|affordable)\b/i.test(queryLower)) {
      sorting = 'price_asc';
    } else if (/\b(expensive|highest\s+price|high\s+to\s+low|price\s+high|premium|luxury)\b/i.test(queryLower)) {
      sorting = 'price_desc';
    } else if (/\b(latest|new|newest|recent|arrivals?)\b/i.test(queryLower)) {
      sorting = 'newest';
    }

    // -------------------------------------------------------------
    // 14. Conversational Refinement & State Merging
    // -------------------------------------------------------------
    if (intent === 'REFINEMENT' && previousState) {
      if (extractedMaxPrice === undefined && previousState.extracted_filters.max_price !== undefined) {
        extractedMaxPrice = previousState.extracted_filters.max_price;
      }
      if (extractedMinPrice === undefined && previousState.extracted_filters.min_price !== undefined) {
        extractedMinPrice = previousState.extracted_filters.min_price;
      }
      if (!extractedGender && previousState.extracted_filters.gender) {
        extractedGender = previousState.extracted_filters.gender;
      }
      if (!extractedCategory && previousState.extracted_filters.category) {
        extractedCategory = previousState.extracted_filters.category;
      }
      if (!extractedBrand && previousState.extracted_filters.brand) {
        extractedBrand = previousState.extracted_filters.brand;
      }
      if (!extractedColor && previousState.extracted_filters.color) {
        extractedColor = previousState.extracted_filters.color;
      }
      if (!extractedSize && previousState.extracted_filters.size) {
        extractedSize = previousState.extracted_filters.size;
      }
      if (!extractedMaterial && previousState.extracted_filters.material) {
        extractedMaterial = previousState.extracted_filters.material;
      }
      if (inStockOnly === undefined && previousState.extracted_filters.in_stock_only) {
        inStockOnly = previousState.extracted_filters.in_stock_only;
      }
    }

    // -------------------------------------------------------------
    // 15. Deduplicate Hard Constraints by Field & Value
    // -------------------------------------------------------------
    const seenConstraintKeys = new Set<string>();
    const uniqueHardConstraints: SearchConstraint[] = [];
    for (const c of hardConstraints) {
      const key = `${c.field}:${c.operator}:${JSON.stringify(c.normalized_value ?? c.value)}`;
      if (!seenConstraintKeys.has(key)) {
        seenConstraintKeys.add(key);
        uniqueHardConstraints.push(c);
      }
    }

    return {
      original_query: queryClean,
      intent,
      product_concepts: Array.from(new Set(productConcepts)),
      hard_constraints: uniqueHardConstraints,
      soft_preferences: Array.from(new Set(softPreferences)),
      semantic_query: semantic_query || queryClean,
      lexical_query: lexical_query || queryClean,
      exclusions,
      sorting,
      sort: sorting,
      pagination: {
        page: previousState && intent === 'REFINEMENT' ? previousState.pagination.page : 1,
        page_size: previousState?.pagination.page_size || 48
      },
      confidence: 0.95,
      extracted_filters: {
        category: extractedCategory,
        product_type: extractedProductType,
        min_price: extractedMinPrice,
        max_price: extractedMaxPrice,
        color: extractedColor,
        size: extractedSize,
        gender: extractedGender,
        audience: extractedGender,
        brand: extractedBrand,
        material: extractedMaterial,
        in_stock_only: inStockOnly,
        exclusions: exclusions.length > 0 ? exclusions : undefined,
        custom_attributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined
      }
    };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isColorToken(token: string): boolean {
  return /^(black|white|red|green|yellow|blue|brown|grey|gray|pink|purple|emerald|maroon|beige|navy|orange|gold|silver|olive|cream|burgundy|crimson|teal|violet|indigo)$/i.test(token);
}

function isSizeToken(token: string): boolean {
  return /^(xxxl|xxl|xl|xs|[smlx]|[0-9]{1,3}|[0-9]{1,2}\.[0-9])$/i.test(token);
}
