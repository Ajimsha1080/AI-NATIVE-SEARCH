import { AIModeProduct, AIModeProductVariant, AIModeSearchPlan, SearchConstraint } from '../types';

export interface EvaluationResult {
  isValid: boolean;
  matchingVariantId?: string;
  failureReason?: string;
  failedConstraint?: string;
  failureCode?: 'price_failed' | 'color_failed' | 'size_failed' | 'category_failed' | 'audience_failed' | 'brand_failed' | 'material_failed' | 'variant_consistency_failed' | 'exclusion_failed' | 'attribute_failed' | 'stock_failed';
}

const COLOR_SYNONYM_FAMILIES: Record<string, string[]> = {
  red: ['red', 'wine', 'maroon', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'coral', 'scarlet'],
  blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky', 'royal blue', 'denim'],
  green: ['green', 'emerald', 'olive', 'mint', 'sage', 'evergreen', 'forest', 'khaki'],
  black: ['black', 'stealth', 'charcoal', 'jet', 'dark', 'obsidian', 'pitch black'],
  white: ['white', 'off-white', 'off white', 'ivory', 'cream', 'pearl'],
  yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon', 'canary'],
  brown: ['brown', 'coffee', 'tan', 'khaki', 'mocha', 'chocolate', 'beige', 'camel'],
  purple: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve', 'magenta'],
  pink: ['pink', 'rose', 'blush', 'salmon', 'fuchsia', 'coral', 'peach'],
  grey: ['grey', 'gray', 'silver', 'slate', 'ash', 'charcoal', 'heather']
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
    // 1. Negative Constraints / Exclusions (Parent & Variant level)
    // -------------------------------------------------------------
    if (plan.exclusions && plan.exclusions.length > 0) {
      const allText = `${product.title} ${product.description || ''} ${product.category || ''} ${(product.subcategories || []).join(' ')} ${JSON.stringify(product.attributes || {})}`.toLowerCase();
      for (const exclusion of plan.exclusions) {
        const exclLower = exclusion.toLowerCase().trim();
        const exclRegex = new RegExp(`\\b${escapeRegex(exclLower)}\\b`, 'i');
        if (exclRegex.test(allText)) {
          return {
            isValid: false,
            failureReason: `Contains excluded term "${exclusion}"`,
            failedConstraint: `exclusion: ${exclusion}`,
            failureCode: 'exclusion_failed'
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 2. Demographic / Audience Compatibility
    // -------------------------------------------------------------
    const targetGender = plan.extracted_filters.gender || plan.extracted_filters.audience;
    if (targetGender) {
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const catLower = (product.category || '').toLowerCase();
      const tagsLower = (product.subcategories || []).map(t => t.toLowerCase());
      const allProductText = `${titleLower} ${descLower} ${catLower} ${tagsLower.join(' ')}`;

      const isExplicitlyWomen = /\b(women|woman|womens|women's|female|ladies|lady|girl|girls|saree|sarees|bow|bows|hair|scrunchie|scrunchies|dress|dresses|kurti|kurtis|skirt|skirts|blouse|gown|lehenga)\b/i.test(allProductText);
      const isExplicitlyMen = (/\b(men|mens|men's|male|man|guys|boy|boys)\b/i.test(allProductText) || tagsLower.includes('men') || descLower.includes('for men') || descLower.includes("men's") || titleLower.includes('men')) && !isExplicitlyWomen;
      const isUnisex = /\b(unisex|couple|combo|oversized|streetwear|tee|t-shirt|hoodie|jacket)\b/i.test(allProductText);

      if (targetGender === 'women' && isExplicitlyMen && !isExplicitlyWomen && !isUnisex) {
        return {
          isValid: false,
          failureReason: `Product is for men, user requested women's collection`,
          failedConstraint: 'audience = women',
          failureCode: 'audience_failed'
        };
      }

      if (targetGender === 'men' && isExplicitlyWomen && !isUnisex) {
        return {
          isValid: false,
          failureReason: `Product is for women, user requested men's collection`,
          failedConstraint: 'audience = men',
          failureCode: 'audience_failed'
        };
      }

      if (targetGender === 'kids') {
        const isKids = /\b(kids?|children|child|baby|toddler|boy|girl)\b/i.test(allProductText);
        if (!isKids) {
          return {
            isValid: false,
            failureReason: `Product is not for kids`,
            failedConstraint: 'audience = kids',
            failureCode: 'audience_failed'
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 3. Category / Product Type Precision Check
    // -------------------------------------------------------------
    const requiredCategory = plan.extracted_filters.category || plan.extracted_filters.product_type;
    if (requiredCategory) {
      const catLower = requiredCategory.toLowerCase().trim();
      const prodCatLower = (product.category || '').toLowerCase().trim();
      const prodTypeLower = (product.product_type || '').toLowerCase().trim();
      const prodTitleLower = (product.title || '').toLowerCase();
      const prodTagsLower = (product.subcategories || []).map(t => t.toLowerCase());

      const catRegex = new RegExp(`\\b${escapeRegex(catLower)}s?\\b`, 'i');
      const matchesCategory = catRegex.test(prodCatLower) || 
                              catRegex.test(prodTypeLower) || 
                              catRegex.test(prodTitleLower) || 
                              prodTagsLower.some(t => catRegex.test(t));

      if (!matchesCategory) {
        return {
          isValid: false,
          failureReason: `Category mismatch: expected "${requiredCategory}", got "${product.category}"`,
          failedConstraint: `category = ${requiredCategory}`,
          failureCode: 'category_failed'
        };
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
      const brandRegex = new RegExp(`\\b${escapeRegex(brandLower)}\\b`, 'i');

      if (!brandRegex.test(prodBrandLower) && !brandRegex.test(prodTitleLower)) {
        return {
          isValid: false,
          failureReason: `Brand mismatch: expected "${requiredBrand}"`,
          failedConstraint: `brand = ${requiredBrand}`,
          failureCode: 'brand_failed'
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
      let primaryFailureReason = '';
      let primaryFailedConstraint = '';
      let primaryFailureCode: EvaluationResult['failureCode'] = 'variant_consistency_failed';

      for (const variant of variants) {
        let variantPassed = true;

        for (const constraint of variantConstraints) {
          const evalRes = this.evaluateVariantConstraint(variant, product, constraint);
          if (!evalRes.passed) {
            variantPassed = false;
            if (!primaryFailureReason) {
              primaryFailureReason = evalRes.reason;
              primaryFailedConstraint = `${constraint.field} ${constraint.operator} ${JSON.stringify(constraint.value)}`;
              primaryFailureCode = evalRes.code;
            }
            break;
          }
        }

        if (variantPassed) {
          matchingVariant = variant;
          break; // Found a valid variant that satisfies all constraints simultaneously
        }
      }

      if (hasVariantConstraints && !matchingVariant) {
        return {
          isValid: false,
          failureReason: primaryFailureReason || `No single variant satisfies all combined variant constraints simultaneously`,
          failedConstraint: primaryFailedConstraint || variantConstraints.map(c => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`).join(' AND '),
          failureCode: primaryFailureCode || 'variant_consistency_failed'
        };
      }

      return {
        isValid: true,
        matchingVariantId: matchingVariant?.id
      };
    }

    // Fallback: Product has no sub-variants, evaluate directly against parent product attributes
    for (const constraint of variantConstraints) {
      const evalRes = this.evaluateParentAsVariant(product, constraint);
      if (!evalRes.passed) {
        return {
          isValid: false,
          failureReason: evalRes.reason,
          failedConstraint: `${constraint.field} ${constraint.operator} ${JSON.stringify(constraint.value)}`,
          failureCode: evalRes.code
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
  ): { passed: boolean; reason: string; code: EvaluationResult['failureCode'] } {
    const { field, operator, value } = constraint;

    // Price
    if (field === 'price') {
      const effectivePrice = typeof variant.price === 'number' && variant.price > 0 ? variant.price : parent.price;
      if (typeof effectivePrice !== 'number') {
        return { passed: false, reason: 'Price unavailable', code: 'price_failed' };
      }

      const numVal = Number(value);
      if (operator === '<=' && effectivePrice > numVal) return { passed: false, reason: `Price ₹${effectivePrice} exceeds max ₹${numVal}`, code: 'price_failed' };
      if (operator === '>=' && effectivePrice < numVal) return { passed: false, reason: `Price ₹${effectivePrice} below min ₹${numVal}`, code: 'price_failed' };
      if (operator === '<' && effectivePrice >= numVal) return { passed: false, reason: `Price ₹${effectivePrice} not below ₹${numVal}`, code: 'price_failed' };
      if (operator === '>' && effectivePrice <= numVal) return { passed: false, reason: `Price ₹${effectivePrice} not above ₹${numVal}`, code: 'price_failed' };
      if (operator === '=' && effectivePrice !== numVal) return { passed: false, reason: `Price ₹${effectivePrice} != ₹${numVal}`, code: 'price_failed' };
      if (operator === 'BETWEEN' && Array.isArray(value) && (effectivePrice < value[0] || effectivePrice > value[1])) {
        return { passed: false, reason: `Price ₹${effectivePrice} not in range [₹${value[0]}, ₹${value[1]}]`, code: 'price_failed' };
      }
      return { passed: true, reason: '', code: undefined };
    }

    // Availability
    if (field === 'in_stock') {
      const inStock = Boolean(variant.in_stock);
      return {
        passed: inStock,
        reason: inStock ? '' : 'Variant out of stock',
        code: 'stock_failed'
      };
    }

    // Color
    if (field === 'color') {
      const targetColor = String(value).toLowerCase().trim();
      const synonyms = COLOR_SYNONYM_FAMILIES[targetColor] || [targetColor];
      const colorRegex = new RegExp(`\\b(?:${synonyms.map(escapeRegex).join('|')})\\b`, 'i');

      const varAttrColor = (variant.attributes?.color || variant.attributes?.colour || variant.attributes?.option1 || '').toLowerCase().trim();
      const varTitle = (variant.title || '').toLowerCase().trim();

      // 1. If variant explicitly specifies its color in attributes
      if (varAttrColor) {
        const matches = colorRegex.test(varAttrColor);
        return {
          passed: matches,
          reason: matches ? '' : `Variant color "${varAttrColor}" does not match requested color "${targetColor}"`,
          code: 'color_failed'
        };
      }

      // 2. If variant title has color word
      if (varTitle && colorRegex.test(varTitle)) {
        return { passed: true, reason: '', code: undefined };
      }

      // 3. Fallback: If variant does not specify color, check parent attributes or parent title with word boundary
      const parentAttrColor = (parent.attributes?.color || parent.attributes?.colour || '').toLowerCase().trim();
      if (parentAttrColor) {
        const matches = colorRegex.test(parentAttrColor);
        return {
          passed: matches,
          reason: matches ? '' : `Product color "${parentAttrColor}" does not match "${targetColor}"`,
          code: 'color_failed'
        };
      }

      const parentTitle = (parent.title || '').toLowerCase();
      if (colorRegex.test(parentTitle)) {
        return { passed: true, reason: '', code: undefined };
      }

      return {
        passed: false,
        reason: `Product does not match color "${targetColor}"`,
        code: 'color_failed'
      };
    }

    // Size
    if (field === 'size') {
      const targetSize = String(value).toUpperCase().trim();
      const varAttrSize = String(variant.attributes?.size || variant.attributes?.option1 || variant.attributes?.option2 || '').toUpperCase().trim();
      const varTitle = (variant.title || '').toUpperCase().trim();

      const sizeRegex = new RegExp(`\\b${escapeRegex(targetSize)}\\b`, 'i');
      if (varAttrSize === targetSize || sizeRegex.test(varAttrSize) || varTitle === targetSize || sizeRegex.test(varTitle)) {
        return { passed: true, reason: '', code: undefined };
      }

      // Check parent attributes / title fallback
      const parentAttrSize = String(parent.attributes?.size || '').toUpperCase().trim();
      if (parentAttrSize === targetSize || sizeRegex.test(parentAttrSize)) {
        return { passed: true, reason: '', code: undefined };
      }

      return {
        passed: false,
        reason: `Variant size "${varAttrSize || varTitle}" does not match requested size "${targetSize}"`,
        code: 'size_failed'
      };
    }

    // Material
    if (field === 'material') {
      const targetMat = String(value).toLowerCase().trim();
      const matRegex = new RegExp(`\\b${escapeRegex(targetMat)}\\b`, 'i');
      const varAttrMat = String(variant.attributes?.material || '').toLowerCase();
      const parentAttrMat = String(parent.attributes?.material || '').toLowerCase();
      const parentTitle = (parent.title || '').toLowerCase();
      const parentDesc = (parent.description || '').toLowerCase();

      if (matRegex.test(varAttrMat) || matRegex.test(parentAttrMat) || matRegex.test(parentTitle) || matRegex.test(parentDesc)) {
        return { passed: true, reason: '', code: undefined };
      }

      return {
        passed: false,
        reason: `Material does not match "${targetMat}"`,
        code: 'material_failed'
      };
    }

    // Generic Custom Attribute Match (e.g. storage, ram, fit, occasion, specification)
    const expectedStr = String(value).toLowerCase().trim();
    const attrVal = String(variant.attributes?.[field] || parent.attributes?.[field] || '').toLowerCase().trim();

    if (attrVal) {
      if (operator === '=') {
        const matches = attrVal === expectedStr || new RegExp(`\\b${escapeRegex(expectedStr)}\\b`, 'i').test(attrVal);
        return {
          passed: matches,
          reason: matches ? '' : `Attribute ${field}="${attrVal}" does not match "${expectedStr}"`,
          code: 'attribute_failed'
        };
      }
      if (operator === 'CONTAINS') {
        const matches = new RegExp(`\\b${escapeRegex(expectedStr)}\\b`, 'i').test(attrVal);
        return {
          passed: matches,
          reason: matches ? '' : `Attribute ${field} does not contain "${expectedStr}"`,
          code: 'attribute_failed'
        };
      }
    }

    // Check title/text with exact word boundary
    const attrRegex = new RegExp(`\\b${escapeRegex(expectedStr)}\\b`, 'i');
    const fullText = `${variant.title} ${parent.title} ${parent.description || ''}`.toLowerCase();
    if (attrRegex.test(fullText)) {
      return { passed: true, reason: '', code: undefined };
    }

    return {
      passed: false,
      reason: `Missing required attribute "${field} = ${expectedStr}"`,
      code: 'attribute_failed'
    };
  }

  /**
   * Evaluates parent product fields when no variants exist
   */
  private static evaluateParentAsVariant(
    parent: AIModeProduct,
    constraint: SearchConstraint
  ): { passed: boolean; reason: string; code: EvaluationResult['failureCode'] } {
    const { field, operator, value } = constraint;

    if (field === 'price') {
      const price = parent.price;
      if (typeof price !== 'number') return { passed: false, reason: 'Price unavailable', code: 'price_failed' };
      const numVal = Number(value);
      if (operator === '<=' && price > numVal) return { passed: false, reason: `Price ₹${price} exceeds ₹${numVal}`, code: 'price_failed' };
      if (operator === '>=' && price < numVal) return { passed: false, reason: `Price ₹${price} below ₹${numVal}`, code: 'price_failed' };
      if (operator === '<' && price >= numVal) return { passed: false, reason: `Price ₹${price} not below ₹${numVal}`, code: 'price_failed' };
      if (operator === '>' && price <= numVal) return { passed: false, reason: `Price ₹${price} not above ₹${numVal}`, code: 'price_failed' };
      if (operator === '=' && price !== numVal) return { passed: false, reason: `Price ₹${price} != ₹${numVal}`, code: 'price_failed' };
      return { passed: true, reason: '', code: undefined };
    }

    if (field === 'in_stock') {
      const inStock = Boolean(parent.in_stock);
      return { passed: inStock, reason: inStock ? '' : 'Product out of stock', code: 'stock_failed' };
    }

    if (field === 'color') {
      const targetColor = String(value).toLowerCase().trim();
      const synonyms = COLOR_SYNONYM_FAMILIES[targetColor] || [targetColor];
      const colorRegex = new RegExp(`\\b(?:${synonyms.map(escapeRegex).join('|')})\\b`, 'i');
      const parentColor = (parent.attributes?.color || parent.attributes?.colour || '').toLowerCase();
      const parentTitle = (parent.title || '').toLowerCase();

      if (colorRegex.test(parentColor) || colorRegex.test(parentTitle)) {
        return { passed: true, reason: '', code: undefined };
      }
      return { passed: false, reason: `Product does not match color "${targetColor}"`, code: 'color_failed' };
    }

    const expected = String(value).toLowerCase().trim();
    const regex = new RegExp(`\\b${escapeRegex(expected)}\\b`, 'i');
    const fullText = `${parent.title} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
    const passed = regex.test(fullText);
    return {
      passed,
      reason: passed ? '' : `Parent product violates "${field} ${operator} ${expected}"`,
      code: 'attribute_failed'
    };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
