import { AIModeProduct, AIModeProductVariant, AIModeSearchPlan, SearchConstraint } from '../types';

export interface EvaluationResult {
  isValid: boolean;
  matchingVariantId?: string;
  failureReason?: string;
  failedConstraint?: string;
}

const COLOR_FAMILY_SYNONYMS: Record<string, string[]> = {
  red: ['red', 'wine', 'maroon', 'crimson', 'burgundy', 'ruby', 'cherry', 'coral', 'rust', 'scarlet'],
  blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky', 'denim', 'sapphire'],
  green: ['green', 'emerald', 'olive', 'sage', 'mint', 'forest', 'evergreen', 'khaki'],
  black: ['black', 'charcoal', 'jet', 'dark', 'obsidian', 'ebony'],
  white: ['white', 'off-white', 'off white', 'ivory', 'cream', 'pearl', 'snow'],
  yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon', 'canary'],
  brown: ['brown', 'coffee', 'tan', 'khaki', 'mocha', 'chocolate', 'caramel'],
  purple: ['purple', 'violet', 'lavender', 'mauve', 'lilac', 'plum', 'magenta'],
  pink: ['pink', 'rose', 'fuchsia', 'blush', 'salmon', 'coral pink'],
  orange: ['orange', 'peach', 'tangerine', 'coral', 'terracotta', 'apricot'],
  grey: ['grey', 'gray', 'silver', 'ash', 'charcoal', 'slate'],
  gray: ['grey', 'gray', 'silver', 'ash', 'charcoal', 'slate'],
  beige: ['beige', 'nude', 'cream', 'sand', 'tan', 'khaki', 'taupe']
};

export class ConstraintEvaluator {
  /**
   * Generic, variant-aware hard constraint evaluation.
   * Ensures that semantic similarity never overrides hard constraints,
   * and that multi-attribute variant requests are satisfied by a SINGLE consistent variant.
   */
  public static evaluateProduct(
    product: AIModeProduct,
    plan: AIModeSearchPlan
  ): EvaluationResult {
    // -------------------------------------------------------------
    // 1. Negative Constraints / Exclusions (Parent-level)
    // -------------------------------------------------------------
    if (plan.exclusions && plan.exclusions.length > 0) {
      const allText = `${product.title} ${product.description || ''} ${product.category || ''} ${(product.subcategories || []).join(' ')} ${JSON.stringify(product.attributes || {})}`.toLowerCase();
      for (const exclusion of plan.exclusions) {
        const exclLower = exclusion.toLowerCase().trim();
        const exclSynonyms = COLOR_FAMILY_SYNONYMS[exclLower] || [exclLower];
        const isExcluded = exclSynonyms.some(e => matchesWordToken(allText, e));
        if (isExcluded) {
          return {
            isValid: false,
            failureReason: `Contains excluded term "${exclusion}"`,
            failedConstraint: `exclusion: ${exclusion}`
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 2. Demographic / Audience Compatibility
    // -------------------------------------------------------------
    const targetGender = plan.extracted_filters.gender;
    if (targetGender) {
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const catLower = (product.category || '').toLowerCase();
      const tagsLower = (product.subcategories || product.tags || []).map(t => t.toLowerCase());
      const audLower = (product.audience || product.attributes?.audience || product.attributes?.gender || '').toLowerCase();
      const allProductText = `${titleLower} ${descLower} ${catLower} ${tagsLower.join(' ')} ${audLower}`;

      const isExplicitlyWomen = (
        audLower === 'women' ||
        tagsLower.includes('women') || tagsLower.includes('womens') || tagsLower.includes("women's") ||
        /\b(women|woman|womens|women's|female|ladies|lady|girls?|saree|sarees|kurti|kurtis|skirt|skirts|blouse|scrunchies?)\b/i.test(titleLower) ||
        /\b(women|woman|womens|women's|female|ladies)\b/i.test(catLower)
      );

      const isExplicitlyMen = (
        audLower === 'men' ||
        tagsLower.includes('men') || tagsLower.includes('mens') || tagsLower.includes("men's") ||
        /\b(men|man|mens|men's|male|gents?|boys?)\b/i.test(titleLower) ||
        /\b(for men|men's collection)\b/i.test(descLower)
      ) && !isExplicitlyWomen;

      const isExplicitlyUnisex = (
        audLower === 'unisex' ||
        tagsLower.includes('unisex') ||
        /\b(unisex|gender-neutral|couple combo)\b/i.test(allProductText)
      );

      if (targetGender === 'women' && isExplicitlyMen && !isExplicitlyWomen && !isExplicitlyUnisex) {
        return {
          isValid: false,
          failureReason: `Product is exclusively for men, user requested women's collection`,
          failedConstraint: 'gender: women'
        };
      }

      if (targetGender === 'men' && isExplicitlyWomen && !isExplicitlyUnisex) {
        return {
          isValid: false,
          failureReason: `Product is exclusively for women, user requested men's collection`,
          failedConstraint: 'gender: men'
        };
      }

      if (targetGender === 'kids') {
        const isKids = audLower === 'kids' || tagsLower.includes('kids') || /\b(kids?|children|child|baby|toddler)\b/i.test(allProductText);
        if (!isKids) {
          return {
            isValid: false,
            failureReason: `Product is not for kids`,
            failedConstraint: 'gender: kids'
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 3. Category / Product Type Precision Check
    // -------------------------------------------------------------
    const requiredCategory = plan.extracted_filters.category || plan.extracted_filters.product_type;
    if (requiredCategory) {
      const catReqNorm = requiredCategory.toLowerCase().trim();
      const catReqStem = stemWord(catReqNorm);

      const prodCatLower = (product.category || '').toLowerCase();
      const prodTypeLower = (product.product_type || '').toLowerCase();
      const prodTitleLower = (product.title || '').toLowerCase();
      const prodTagsLower = (product.subcategories || product.tags || []).map(t => t.toLowerCase());

      const matchesCat = (
        matchesWordToken(prodCatLower, catReqNorm) ||
        matchesWordToken(prodCatLower, catReqStem) ||
        matchesWordToken(prodTypeLower, catReqNorm) ||
        matchesWordToken(prodTypeLower, catReqStem) ||
        matchesWordToken(prodTitleLower, catReqNorm) ||
        matchesWordToken(prodTitleLower, catReqStem) ||
        prodTagsLower.some(t => matchesWordToken(t, catReqNorm) || matchesWordToken(t, catReqStem))
      );

      if (!matchesCat) {
        return {
          isValid: false,
          failureReason: `Category mismatch: expected "${requiredCategory}", product is "${product.category || product.product_type || 'Other'}"`,
          failedConstraint: `category: ${requiredCategory}`
        };
      }

      // Concept-level distinctness: A distinct concept must not bleed into an incompatible one
      // e.g. "shirt" (formal/casual woven shirt) vs pure "outerwear" (jacket/balaclava/visor)
      if (catReqStem === 'shirt') {
        const isPureOuterwearWithoutShirt = /\b(jacket|outerwear|visor|balaclava|windbreaker|coat)\b/i.test(prodCatLower) &&
          !/\bshirts?\b/i.test(prodTitleLower) && !/\bshirts?\b/i.test(prodCatLower);
        if (isPureOuterwearWithoutShirt) {
          return {
            isValid: false,
            failureReason: `Concept mismatch: product is Outerwear/Jacket, expected Shirt`,
            failedConstraint: `category: ${requiredCategory}`
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 4. Brand Match Check
    // -------------------------------------------------------------
    const requiredBrand = plan.extracted_filters.brand;
    if (requiredBrand) {
      const brandLower = requiredBrand.toLowerCase().trim();
      const prodBrandLower = (product.brand || product.attributes?.brand || '').toLowerCase().trim();
      const prodTitleLower = (product.title || '').toLowerCase();

      if (!matchesWordToken(prodBrandLower, brandLower) && !matchesWordToken(prodTitleLower, brandLower)) {
        return {
          isValid: false,
          failureReason: `Brand mismatch: expected "${requiredBrand}"`,
          failedConstraint: `brand: ${requiredBrand}`
        };
      }
    }

    // -------------------------------------------------------------
    // 5. Variant-Aware Multi-Attribute Consistency Evaluation
    // -------------------------------------------------------------
    const variantConstraints = plan.hard_constraints.filter(c => c.is_variant_level && c.is_hard);
    const hasVariantConstraints = variantConstraints.length > 0;
    const variants = product.variants && product.variants.length > 0 ? product.variants : [];

    if (variants.length > 0) {
      // Must find AT LEAST ONE single variant that satisfies ALL variant-level constraints simultaneously
      let matchingVariant: AIModeProductVariant | null = null;

      for (const variant of variants) {
        let variantPassed = true;

        for (const constraint of variantConstraints) {
          const pass = this.evaluateVariantConstraint(variant, product, constraint);
          if (!pass) {
            variantPassed = false;
            break;
          }
        }

        if (variantPassed) {
          matchingVariant = variant;
          break; // Found eligible single variant satisfying all constraints
        }
      }

      if (hasVariantConstraints && !matchingVariant) {
        return {
          isValid: false,
          failureReason: `No single variant satisfies all combined variant constraints simultaneously`,
          failedConstraint: variantConstraints.map(c => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`).join(' AND ')
        };
      }

      return {
        isValid: true,
        matchingVariantId: matchingVariant?.id
      };
    }

    // Fallback: Product has no sub-variants, evaluate directly against parent product attributes
    for (const constraint of variantConstraints) {
      const pass = this.evaluateParentAsVariant(product, constraint);
      if (!pass) {
        return {
          isValid: false,
          failureReason: `Parent product violates constraint "${constraint.field} ${constraint.operator} ${constraint.value}"`,
          failedConstraint: `${constraint.field}: ${constraint.value}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Evaluates a single variant against a specific constraint
   */
  private static evaluateVariantConstraint(
    variant: AIModeProductVariant,
    parent: AIModeProduct,
    constraint: SearchConstraint
  ): boolean {
    const { field, operator, value } = constraint;

    // 1. Price Comparison
    if (field === 'price') {
      const effectivePrice = typeof variant.price === 'number' && variant.price > 0 ? variant.price : parent.price;
      if (typeof effectivePrice !== 'number') return false;

      if (operator === '<=') return effectivePrice <= Number(value);
      if (operator === '>=') return effectivePrice >= Number(value);
      if (operator === '<') return effectivePrice < Number(value);
      if (operator === '>') return effectivePrice > Number(value);
      if (operator === '=') return effectivePrice === Number(value);
      return true;
    }

    // 2. Availability / In Stock
    if (field === 'in_stock') {
      return Boolean(variant.in_stock);
    }

    // 3. Color (Strict Word-Boundary & Synonym Family Matching)
    if (field === 'color') {
      const expectedColor = String(value).toLowerCase().trim();
      const colorSynonyms = COLOR_FAMILY_SYNONYMS[expectedColor] || [expectedColor];

      const vColorAttr = String(variant.attributes?.color || '').toLowerCase().trim();
      const vTitle = String(variant.title || '').toLowerCase();
      const pColorAttr = String(parent.attributes?.color || '').toLowerCase().trim();
      const pTitle = String(parent.title || '').toLowerCase();
      const pTags = (parent.subcategories || parent.tags || []).map(t => t.toLowerCase());

      // If variant has explicit color attribute, it MUST match the requested color family
      if (vColorAttr) {
        const matchesVarAttr = colorSynonyms.some(c => matchesWordToken(vColorAttr, c));
        if (!matchesVarAttr) return false;
        return true;
      }

      // Check variant title
      const matchesVarTitle = colorSynonyms.some(c => matchesWordToken(vTitle, c));
      if (matchesVarTitle) return true;

      // If parent has explicit color attribute
      if (pColorAttr) {
        const matchesParentAttr = colorSynonyms.some(c => matchesWordToken(pColorAttr, c));
        if (!matchesParentAttr) return false;
        return true;
      }

      // Check parent title or tags with word boundary
      const matchesParentTitle = colorSynonyms.some(c => matchesWordToken(pTitle, c));
      const matchesParentTags = colorSynonyms.some(c => pTags.some(t => matchesWordToken(t, c)));

      return matchesParentTitle || matchesParentTags;
    }

    // 4. Size (Strict Word-Boundary Token Matching)
    if (field === 'size') {
      const expectedSize = String(value).toLowerCase().trim();
      const vSizeAttr = String(variant.attributes?.size || '').toLowerCase().trim();
      const vTitle = String(variant.title || '').toLowerCase();
      const pSizeAttr = String(parent.attributes?.size || '').toLowerCase().trim();

      if (vSizeAttr) {
        if (vSizeAttr === expectedSize || matchesWordToken(vSizeAttr, expectedSize)) return true;
      }

      if (matchesWordToken(vTitle, expectedSize) || vTitle === expectedSize) return true;

      if (pSizeAttr && (pSizeAttr === expectedSize || matchesWordToken(pSizeAttr, expectedSize))) {
        return true;
      }

      return false;
    }

    // 5. Custom Variant Attributes (e.g. material, sleeve, fit, pattern)
    const vVal = variant.attributes?.[field];
    const pVal = parent.attributes?.[field];
    const attrVal = vVal !== undefined ? vVal : pVal;

    if (attrVal !== undefined) {
      const valStr = String(attrVal).toLowerCase().trim();
      const expectedStr = String(value).toLowerCase().trim();
      if (operator === '=') return valStr === expectedStr || matchesWordToken(valStr, expectedStr);
      if (operator === 'CONTAINS') return matchesWordToken(valStr, expectedStr);
      if (operator === '!=') return valStr !== expectedStr;
    }

    // General token match in variant title
    const vTitleLower = (variant.title || '').toLowerCase();
    const expectedLower = String(value).toLowerCase().trim();
    return matchesWordToken(vTitleLower, expectedLower);
  }

  /**
   * Evaluates parent product fields when no variants exist
   */
  private static evaluateParentAsVariant(
    parent: AIModeProduct,
    constraint: SearchConstraint
  ): boolean {
    const { field, operator, value } = constraint;

    if (field === 'price') {
      const price = parent.price;
      if (typeof price !== 'number') return false;
      if (operator === '<=') return price <= Number(value);
      if (operator === '>=') return price >= Number(value);
      if (operator === '<') return price < Number(value);
      if (operator === '>') return price > Number(value);
      if (operator === '=') return price === Number(value);
      return true;
    }

    if (field === 'in_stock') {
      return Boolean(parent.in_stock);
    }

    if (field === 'color') {
      const expectedColor = String(value).toLowerCase().trim();
      const colorSynonyms = COLOR_FAMILY_SYNONYMS[expectedColor] || [expectedColor];
      const pColorAttr = String(parent.attributes?.color || '').toLowerCase();
      const pTitle = (parent.title || '').toLowerCase();
      const pTags = (parent.subcategories || parent.tags || []).map(t => t.toLowerCase());

      return colorSynonyms.some(c => 
        matchesWordToken(pColorAttr, c) || 
        matchesWordToken(pTitle, c) || 
        pTags.some(t => matchesWordToken(t, c))
      );
    }

    if (field === 'size') {
      const expectedSize = String(value).toLowerCase().trim();
      const pSizeAttr = String(parent.attributes?.size || '').toLowerCase();
      const pTitle = (parent.title || '').toLowerCase();
      return matchesWordToken(pSizeAttr, expectedSize) || matchesWordToken(pTitle, expectedSize);
    }

    const pAttr = parent.attributes?.[field];
    if (pAttr !== undefined) {
      const valStr = String(pAttr).toLowerCase().trim();
      const expectedStr = String(value).toLowerCase().trim();
      if (operator === '=') return valStr === expectedStr || matchesWordToken(valStr, expectedStr);
      if (operator === 'CONTAINS') return matchesWordToken(valStr, expectedStr);
      if (operator === '!=') return valStr !== expectedStr;
    }

    const allText = `${parent.title} ${(parent.subcategories || []).join(' ')}`.toLowerCase();
    const expected = String(value).toLowerCase().trim();
    return matchesWordToken(allText, expected);
  }
}

/**
 * Strict word-boundary token matcher to prevent substring false positives
 * (e.g. "red" matching "embroidered", "tailored", "offered", "hundred", etc.)
 */
function matchesWordToken(text: string, token: string): boolean {
  if (!text || !token) return false;
  const escaped = escapeRegex(token.trim().toLowerCase());
  const regex = new RegExp(`(^|[^a-zA-Z0-9-])${escaped}([^a-zA-Z0-9-]|$)`, 'i');
  return regex.test(text.toLowerCase());
}

/**
 * Basic word stemmer for bidirectional singular/plural normalization
 */
function stemWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 3 && !w.endsWith('ees')) return w.slice(0, -2);
  if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
