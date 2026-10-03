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
  'search', 'browse', 'recommend', 'suggest', 'collection', 'catalog', 'pieces', 'piece'
]);

const SOFT_PREFERENCE_VOCABULARY = new Set([
  'casual', 'formal', 'elegant', 'stylish', 'modern', 'vintage', 'classic', 'chic',
  'party', 'wedding', 'festive', 'festival', 'office', 'work', 'workplace', 'daily',
  'daily wear', 'summer', 'winter', 'autumn', 'spring', 'monsoon', 'vacation', 'holiday',
  'trip', 'travel', 'comfortable', 'comfort', 'luxury', 'premium', 'minimalist', 'bold',
  'trendy', 'popular', 'latest', 'lightweight', 'breathable', 'durable', 'cozy', 'warm',
  'active', 'gym', 'workout', 'fitness', 'sporty', 'night', 'dinner', 'date', 'cool', 'nice',
  'fancy', 'designer', 'classy', 'smart', 'neat', 'clean', 'simple', 'luxe', 'aesthetic'
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

const COMPOUND_COLORS = [
  'navy blue', 'dark blue', 'light blue', 'sky blue', 'royal blue', 'baby blue', 'powder blue', 'midnight blue', 'ocean blue', 'denim blue', 'azure blue', 'ice blue',
  'dark green', 'olive green', 'mint green', 'forest green', 'sage green', 'emerald green', 'bottle green', 'army green', 'lime green', 'sea green',
  'wine red', 'dark red', 'cherry red', 'brick red', 'ruby red', 'crimson red', 'coral red', 'blood red',
  'jet black', 'pitch black', 'matte black', 'charcoal black',
  'off white', 'off-white', 'pure white', 'snow white', 'pearl white', 'cream white',
  'charcoal grey', 'dark grey', 'light grey', 'slate grey', 'ash grey', 'silver grey', 'charcoal gray', 'dark gray', 'light gray', 'slate gray', 'ash gray',
  'dusty pink', 'baby pink', 'rose pink', 'hot pink', 'salmon pink', 'blush pink',
  'mustard yellow', 'lemon yellow', 'golden yellow', 'bright yellow',
  'dark brown', 'light brown', 'coffee brown', 'chocolate brown', 'camel brown',
  'rose gold', 'yellow gold', 'metallic silver', 'space grey', 'space gray'
];

const SINGLE_COLORS = [
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'brown', 'grey', 'gray', 'pink',
  'purple', 'emerald', 'maroon', 'beige', 'navy', 'orange', 'gold', 'silver', 'olive',
  'cream', 'burgundy', 'crimson', 'teal', 'violet', 'indigo', 'rust', 'coral', 'khaki',
  'tan', 'charcoal', 'wine', 'turquoise', 'fuchsia', 'magenta', 'plum', 'lavender',
  'lilac', 'peach', 'bronze', 'copper', 'mint', 'mustard', 'ochre', 'ivory', 'amber', 'cyan', 'azure', 'denim'
];

const COMMON_MATERIALS = [
  'cotton', 'linen', 'silk', 'denim', 'corduroy', 'polyester', 'leather', 'wool', 'fleece',
  'nylon', 'satin', 'velvet', 'canvas', 'mesh', 'cashmere', 'viscose', 'modal', 'rayon',
  'spandex', 'poplin', 'chiffon', 'georgette', 'crepe', 'khadi', 'flannel', 'tweed',
  'bamboo', 'lycra', 'terry', 'jersey', 'gold', 'silver', 'stainless steel', 'titanium',
  'wood', 'ceramic', 'glass', 'plastic'
];

const STANDARD_PRODUCT_TYPES = [
  't-shirt', 'tshirt', 'tee', 'shirt', 'hoodie', 'sweatshirt', 'jacket', 'shacket', 'blazer',
  'coat', 'jogger', 'joggers', 'sweatpants', 'trackpant', 'trackpants', 'pant', 'pants',
  'trouser', 'trousers', 'chinos', 'jeans', 'denim', 'short', 'shorts', 'saree', 'sari',
  'kurta', 'kurti', 'dress', 'dresses', 'gown', 'gowns', 'frock', 'skirt', 'skirts',
  'lehenga', 'shoe', 'shoes', 'sneaker', 'sneakers', 'sandal', 'sandals', 'boot', 'boots',
  'slipper', 'slippers', 'balaclava', 'visor', 'visors', 'cap', 'caps', 'hat', 'hats',
  'beanie', 'sunglasses', 'eyewear', 'glasses', 'watch', 'watches', 'smartwatch', 'bag',
  'bags', 'backpack', 'backpacks', 'handbag', 'handbags', 'wallet', 'wallets', 'perfume',
  'perfumes', 'fragrance', 'cologne', 'sunscreen', 'scrunchie', 'scrunchies', 'belt', 'belts',
  'combo', 'suit', 'activewear'
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
    const exclusionRegex = /\b(?:not|without|no|exclude|excluding|except|non-?)\s+([a-z0-9\-_]+(?:\s+[a-z0-9\-_]+)?)\b/gi;
    let exclMatch;
    while ((exclMatch = exclusionRegex.exec(queryLower)) !== null) {
      const term = exclMatch[1].trim();
      if (term && !GENERAL_STOP_WORDS.has(term)) {
        exclusions.push(term);
        hardConstraints.push({
          field: 'all',
          operator: 'NOT_IN',
          value: term,
          is_hard: true,
          is_variant_level: false,
          confidence: 0.95,
          raw_token: exclMatch[0]
        });
      }
    }

    // -------------------------------------------------------------
    // 3. Numeric Price & Range Constraints
    // -------------------------------------------------------------
    // Range: "between 1000 and 2000", "from 500 to 1500", "1000 - 2000", "1000 to 2000"
    const rangeMatch = queryLower.match(/(?:between|from)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)\s*(?:to|-|and)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)/i) ||
                       queryLower.match(/(\d+(?:,\d+)?)\s*(?:-|to)\s*(\d+(?:,\d+)?)\s*(?:rs\.?|inr|rupees?|bucks?|₹|\$)/i);
    if (rangeMatch) {
      extractedMinPrice = parseFloat(rangeMatch[1].replace(/,/g, ''));
      extractedMaxPrice = parseFloat(rangeMatch[2].replace(/,/g, ''));
    }

    // Upper bound: "under 2000", "below 1500", "less than 2000", "max 3000", "budget 2500", "up to 2000", "upto 2k"
    if (extractedMaxPrice === undefined) {
      const underMatch = queryLower.match(/(?:under|below|less\s+than|max(?:imum)?|budget|within|upto|up\s+to)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(k|thousand)?\b/i) ||
                         queryLower.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand)\s*(?:budget|max|under)?\b/i);
      if (underMatch) {
        const isK = underMatch[0].toLowerCase().includes('k') || underMatch[2]?.toLowerCase() === 'k';
        const numVal = parseFloat(underMatch[1].replace(/,/g, ''));
        extractedMaxPrice = isK ? numVal * 1000 : numVal;
      }
    }

    // Lower bound: "above 500", "over 1000", "more than 500", "min 500", "starting from 1000", "at least 500"
    if (extractedMinPrice === undefined) {
      const aboveMatch = queryLower.match(/(?:above|over|more\s+than|min(?:imum)?|from|starting\s+at|starting\s+from|at\s+least)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(k|thousand)?\b/i);
      if (aboveMatch) {
        const isK = aboveMatch[0].toLowerCase().includes('k') || aboveMatch[2]?.toLowerCase() === 'k';
        const numVal = parseFloat(aboveMatch[1].replace(/,/g, ''));
        extractedMinPrice = isK ? numVal * 1000 : numVal;
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

    if (extractedMaxPrice !== undefined) {
      hardConstraints.push({
        field: 'price',
        operator: '<=',
        value: extractedMaxPrice,
        is_hard: true,
        is_variant_level: true,
        confidence: 0.98
      });
    }

    if (extractedMinPrice !== undefined) {
      hardConstraints.push({
        field: 'price',
        operator: '>=',
        value: extractedMinPrice,
        is_hard: true,
        is_variant_level: true,
        confidence: 0.98
      });
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
        is_hard: true,
        is_variant_level: true,
        confidence: 0.95
      });
    }

    // -------------------------------------------------------------
    // 5. Gender / Demographic Audience Constraint
    // -------------------------------------------------------------
    for (const [alias, normalizedGender] of Object.entries(DEMOGRAPHIC_ALIASES)) {
      const aliasRegex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
      if (aliasRegex.test(queryLower) && !exclusions.includes(alias)) {
        extractedGender = normalizedGender;
        hardConstraints.push({
          field: 'audience',
          operator: '=',
          value: normalizedGender,
          is_hard: true,
          is_variant_level: false,
          confidence: 0.95,
          raw_token: alias
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 6. Dynamic Color Extraction (Compound first, then single)
    // -------------------------------------------------------------
    // Check compound colors first (e.g. "navy blue", "dark green", "off white")
    for (const cColor of COMPOUND_COLORS) {
      const cRegex = new RegExp(`\\b${escapeRegex(cColor)}\\b`, 'i');
      if (cRegex.test(queryLower) && !exclusions.includes(cColor)) {
        extractedColor = cColor;
        hardConstraints.push({
          field: 'color',
          operator: '=',
          value: cColor,
          is_hard: true,
          is_variant_level: true,
          confidence: 0.96,
          raw_token: cColor
        });
        break;
      }
    }

    // Fallback: Check single color tokens if no compound color matched
    if (!extractedColor) {
      for (const sColor of SINGLE_COLORS) {
        const sRegex = new RegExp(`\\b${escapeRegex(sColor)}\\b`, 'i');
        if (sRegex.test(queryLower) && !exclusions.includes(sColor)) {
          extractedColor = sColor;
          hardConstraints.push({
            field: 'color',
            operator: '=',
            value: sColor,
            is_hard: true,
            is_variant_level: true,
            confidence: 0.95,
            raw_token: sColor
          });
          break;
        }
      }
    }

    // Introspect schema for merchant custom color attribute values
    if (schema) {
      for (const [attrKey, attrValueSet] of schema.attributeValues.entries()) {
        if (attrKey.includes('color')) {
          for (const val of attrValueSet) {
            const valNorm = val.toLowerCase().trim();
            if (valNorm.length >= 2 && !exclusions.includes(valNorm)) {
              const valRegex = new RegExp(`\\b${escapeRegex(valNorm)}\\b`, 'i');
              if (valRegex.test(queryLower) && !extractedColor) {
                extractedColor = val;
                hardConstraints.push({
                  field: 'color',
                  operator: '=',
                  value: val,
                  is_hard: true,
                  is_variant_level: true,
                  confidence: 0.95,
                  raw_token: val
                });
                break;
              }
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 7. Dynamic Size Extraction (Explicit & Variant)
    // -------------------------------------------------------------
    const sizeMatch = queryLower.match(/\bsize\s*([0-9a-z\-_]+(?:\s*[0-9a-z\-_]+)?)\b/i) || 
                      queryLower.match(/\b(xxxl|xxl|3xl|2xl|xl|xs|[smlx]|free\s*size)\s+size\b/i) ||
                      queryLower.match(/\b(xxxl|xxl|3xl|2xl|xl|xs|[smlx]|free\s*size)\b/i);
    if (sizeMatch && !exclusions.includes(sizeMatch[1].toLowerCase())) {
      extractedSize = sizeMatch[1].toUpperCase().replace(/\s+/g, ' ');
      hardConstraints.push({
        field: 'size',
        operator: '=',
        value: extractedSize,
        is_hard: true,
        is_variant_level: true,
        confidence: 0.95,
        raw_token: sizeMatch[0]
      });
    }

    // -------------------------------------------------------------
    // 8. Dynamic Material Extraction
    // -------------------------------------------------------------
    for (const mat of COMMON_MATERIALS) {
      const matRegex = new RegExp(`\\b${escapeRegex(mat)}\\b`, 'i');
      if (matRegex.test(queryLower) && !exclusions.includes(mat)) {
        extractedMaterial = mat;
        hardConstraints.push({
          field: 'material',
          operator: '=',
          value: mat,
          is_hard: true,
          is_variant_level: false,
          confidence: 0.92,
          raw_token: mat
        });
        break;
      }
    }

    // -------------------------------------------------------------
    // 9. Dynamic Brand Extraction
    // -------------------------------------------------------------
    if (schema) {
      for (const brand of schema.brands) {
        const brandNorm = brand.toLowerCase().trim();
        const brandRegex = new RegExp(`\\b${escapeRegex(brandNorm)}\\b`, 'i');
        if (brandRegex.test(queryLower) && !exclusions.includes(brandNorm)) {
          extractedBrand = brand;
          hardConstraints.push({
            field: 'brand',
            operator: '=',
            value: brand,
            is_hard: true,
            is_variant_level: false,
            confidence: 0.98,
            raw_token: brand
          });
          break;
        }
      }
    }

    // -------------------------------------------------------------
    // 10. Dynamic Category & Product Type Introspection
    // -------------------------------------------------------------
    // Check compound apparel terms (e.g. t-shirt / tee vs basic shirt)
    const hasTshirtToken = /\b(t-?shirt|tee|tshirt|t-shirts|tees|tshirts)\b/i.test(queryLower);

    if (hasTshirtToken) {
      extractedCategory = 'T-Shirt';
      extractedProductType = 'T-Shirt';
      productConcepts.push('T-Shirt');
      hardConstraints.push({
        field: 'category',
        operator: '=',
        value: 'T-Shirt',
        is_hard: true,
        is_variant_level: false,
        confidence: 0.95,
        raw_token: 't-shirt'
      });
    } else if (/\bshirts?\b/i.test(queryLower)) {
      extractedCategory = 'Shirt';
      extractedProductType = 'Shirt';
      productConcepts.push('Shirt');
      hardConstraints.push({
        field: 'category',
        operator: '=',
        value: 'Shirt',
        is_hard: true,
        is_variant_level: false,
        confidence: 0.95,
        raw_token: 'shirt'
      });
    } else if (schema && schema.categories.size > 0) {
      for (const cat of schema.categories) {
        const catNorm = cat.toLowerCase().trim();
        const catStem = catNorm.replace(/s$/, '');
        const catRegex = new RegExp(`\\b${escapeRegex(catStem)}s?\\b`, 'i');
        
        if (catRegex.test(queryLower) && !exclusions.includes(catNorm)) {
          extractedCategory = cat;
          extractedProductType = cat;
          productConcepts.push(cat);
          hardConstraints.push({
            field: 'category',
            operator: '=',
            value: cat,
            is_hard: true,
            is_variant_level: false,
            confidence: 0.92,
            raw_token: cat
          });
          break;
        }
      }
    }

    // Fallback: Standard ecommerce product types if category not resolved from schema
    if (!extractedCategory) {
      for (const pType of STANDARD_PRODUCT_TYPES) {
        const isCompound = /t-?shirt|tee/i.test(pType);
        if (isCompound && hasTshirtToken) {
          extractedCategory = 'T-Shirt';
          extractedProductType = 'T-Shirt';
          productConcepts.push('T-Shirt');
          hardConstraints.push({
            field: 'category',
            operator: '=',
            value: 'T-Shirt',
            is_hard: true,
            is_variant_level: false,
            confidence: 0.92,
            raw_token: pType
          });
          break;
        }

        if (!isCompound && pType === 'shirt' && !hasTshirtToken && /\bshirts?\b/i.test(queryLower)) {
          extractedCategory = 'Shirt';
          extractedProductType = 'Shirt';
          productConcepts.push('Shirt');
          hardConstraints.push({
            field: 'category',
            operator: '=',
            value: 'Shirt',
            is_hard: true,
            is_variant_level: false,
            confidence: 0.92,
            raw_token: 'shirt'
          });
          break;
        }

        const pTypeRegex = new RegExp(`\\b${escapeRegex(pType)}s?\\b`, 'i');
        if (pTypeRegex.test(queryLower) && !exclusions.includes(pType)) {
          const capType = pType.charAt(0).toUpperCase() + pType.slice(1);
          extractedCategory = capType;
          extractedProductType = capType;
          productConcepts.push(capType);
          hardConstraints.push({
            field: 'category',
            operator: '=',
            value: capType,
            is_hard: true,
            is_variant_level: false,
            confidence: 0.90,
            raw_token: pType
          });
          break;
        }
      }
    }

    // -------------------------------------------------------------
    // 11. Dynamic Schema Attributes (Arbitrary E-Commerce Dimensions)
    // -------------------------------------------------------------
    if (schema) {
      for (const [attrKey, attrValueSet] of schema.attributeValues.entries()) {
        if (attrKey.includes('color') || attrKey.includes('size') || attrKey === 'brand' || attrKey === 'category') continue;

        for (const attrVal of attrValueSet) {
          const valNorm = attrVal.toLowerCase().trim();
          if (valNorm.length < 2 || GENERAL_STOP_WORDS.has(valNorm) || exclusions.includes(valNorm)) continue;

          const valRegex = new RegExp(`\\b${escapeRegex(valNorm)}\\b`, 'i');
          if (valRegex.test(queryLower)) {
            customAttributes[attrKey] = attrVal;
            hardConstraints.push({
              field: attrKey,
              operator: '=',
              value: attrVal,
              is_hard: true,
              is_variant_level: true,
              confidence: 0.90,
              raw_token: attrVal
            });
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 12. Soft Preferences & Stylistic Concepts
    // -------------------------------------------------------------
    const rawTokens = queryLower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (const token of rawTokens) {
      if (SOFT_PREFERENCE_VOCABULARY.has(token) && !exclusions.includes(token)) {
        softPreferences.push(token);
      }
    }

    // -------------------------------------------------------------
    // 13. Semantic & Lexical Query Cleaning
    // -------------------------------------------------------------
    const nonContentTokens = new Set([
      ...GENERAL_STOP_WORDS,
      ...exclusions,
      ...(extractedBrand ? extractedBrand.toLowerCase().split(/\s+/) : []),
      ...(extractedColor ? extractedColor.toLowerCase().split(/\s+/) : []),
      ...(extractedSize ? [extractedSize.toLowerCase()] : []),
      ...(extractedGender ? [extractedGender.toLowerCase()] : [])
    ]);

    const lexicalTokens = rawTokens.filter(t => !nonContentTokens.has(t) && isNaN(Number(t)));
    const lexical_query = lexicalTokens.join(' ');

    let semantic_query = queryClean;
    if (exclusions.length > 0) {
      semantic_query = semantic_query.replace(/\b(?:not|without|no|exclude|excluding|except|non-?)\s+[a-z0-9\-_]+/gi, '').trim();
    }

    // -------------------------------------------------------------
    // 14. Sorting Preference
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
    // 15. Conversational Refinement & State Merging
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

    return {
      original_query: queryClean,
      intent,
      product_concepts: Array.from(new Set(productConcepts)),
      hard_constraints: hardConstraints,
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
