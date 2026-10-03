import { AIModeProduct, AIModeProductVariant, AIModeSearchPlan, SearchConstraint } from '../types';

export interface EvaluationResult {
  isValid: boolean;
  matchingVariantId?: string;
  failureReason?: string;
  failedConstraint?: string;
}

const COLOR_FAMILIES: Record<string, string[]> = {
  blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky', 'royal', 'cobalt', 'ocean', 'denim'],
  navy: ['navy', 'navy blue', 'dark blue', 'midnight blue', 'indigo'],
  red: ['red', 'wine', 'maroon', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'coral', 'brick', 'rose', 'scarlet'],
  maroon: ['maroon', 'wine', 'burgundy', 'dark red'],
  wine: ['wine', 'maroon', 'burgundy', 'dark red'],
  green: ['green', 'emerald', 'olive', 'mint', 'sage', 'evergreen', 'forest', 'army', 'bottle', 'lime'],
  olive: ['olive', 'olive green', 'sage', 'khaki green', 'army green'],
  emerald: ['emerald', 'emerald green', 'bottle green', 'forest green'],
  black: ['black', 'stealth', 'charcoal', 'jet', 'dark', 'obsidian', 'onyx', 'pitch', 'ebony'],
  white: ['white', 'off-white', 'off white', 'ivory', 'cream', 'pearl', 'snow', 'eggshell'],
  'off white': ['off white', 'off-white', 'ivory', 'cream'],
  'off-white': ['off white', 'off-white', 'ivory', 'cream'],
  yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon', 'ochre', 'sunny'],
  mustard: ['mustard', 'mustard yellow', 'ochre', 'gold'],
  brown: ['brown', 'coffee', 'tan', 'khaki', 'mocha', 'chocolate', 'camel', 'caramel', 'bronze', 'beige', 'taupe'],
  beige: ['beige', 'tan', 'khaki', 'cream', 'camel'],
  pink: ['pink', 'rose', 'blush', 'magenta', 'salmon', 'fuchsia', 'coral', 'peach'],
  purple: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve', 'eggplant', 'grape'],
  grey: ['grey', 'gray', 'silver', 'ash', 'smoke', 'slate', 'gunmetal', 'heather', 'charcoal'],
  gray: ['grey', 'gray', 'silver', 'ash', 'smoke', 'slate', 'gunmetal', 'heather', 'charcoal'],
  orange: ['orange', 'rust', 'coral', 'peach', 'amber', 'apricot', 'tangerine']
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
      const allParentText = `${product.title} ${product.description || ''} ${product.category || ''} ${(product.subcategories || []).join(' ')} ${JSON.stringify(product.attributes || {})}`.toLowerCase();
      
      for (const exclusion of plan.exclusions) {
        const exclLower = exclusion.toLowerCase().trim();
        const exclRegex = new RegExp(`\\b${escapeRegex(exclLower)}\\b`, 'i');
        
        if (exclRegex.test(allParentText)) {
          return {
            isValid: false,
            failureReason: `Contains excluded term "${exclusion}"`,
            failedConstraint: `exclusion: ${exclusion}`
          };
        }

        // Check inside variants
        if (product.variants && product.variants.length > 0) {
          for (const v of product.variants) {
            const vText = `${v.title} ${JSON.stringify(v.attributes || {})}`.toLowerCase();
            if (exclRegex.test(vText)) {
              return {
                isValid: false,
                failureReason: `Variant contains excluded term "${exclusion}"`,
                failedConstraint: `exclusion: ${exclusion}`
              };
            }
          }
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
      const tagsLower = (product.subcategories || []).map(t => t.toLowerCase());
      const allProductText = `${titleLower} ${descLower} ${catLower} ${tagsLower.join(' ')}`;

      const isExplicitlyWomen = /\b(women|woman|womens|women's|female|ladies|lady|girl|girls|saree|sarees|bow|bows|hair|scrunchie|scrunchies|dress|dresses|kurti|kurtis|skirt|skirts|blouse)\b/i.test(allProductText);
      const isExplicitlyMen = (/\b(men|mens|men's|male|man|guys|boy|boys)\b/i.test(allProductText) || tagsLower.includes('men') || tagsLower.includes('men shirt') || descLower.includes('for men') || descLower.includes("men's")) && !isExplicitlyWomen;
      const isUnisex = /\b(unisex|couple|combo|oversized|streetwear|hoodie|jacket)\b/i.test(allProductText);

      if (targetGender === 'women' && isExplicitlyMen && !isExplicitlyWomen && !isUnisex) {
        return {
          isValid: false,
          failureReason: `Product is for men, user requested women's collection`,
          failedConstraint: 'audience: women'
        };
      }

      if (targetGender === 'men' && isExplicitlyWomen && !isUnisex) {
        return {
          isValid: false,
          failureReason: `Product is for women, user requested men's collection`,
          failedConstraint: 'audience: men'
        };
      }

      if (targetGender === 'kids') {
        const isKids = /\b(kids?|children|child|baby|toddler|boy|girl)\b/i.test(allProductText);
        if (!isKids) {
          return {
            isValid: false,
            failureReason: `Product is not for kids`,
            failedConstraint: 'audience: kids'
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 3. Category / Product Type Precision Check
    // -------------------------------------------------------------
    const requiredCategory = plan.extracted_filters.category || plan.extracted_filters.product_type;
    if (requiredCategory) {
      const reqCatLower = requiredCategory.toLowerCase().trim();
      const prodCatLower = (product.category || '').toLowerCase().trim();
      const prodTitleLower = (product.title || '').toLowerCase().trim();
      const prodTagsLower = (product.subcategories || []).map(t => t.toLowerCase().trim());
      const fullTaxonomy = `${prodCatLower} ${prodTitleLower} ${prodTagsLower.join(' ')}`;

      // Special Word Boundary Precision for Apparel
      const isReqShirt = reqCatLower === 'shirt';
      const isReqTshirt = /t-?shirt|tee/i.test(reqCatLower);

      if (isReqShirt) {
        // Query specifically asked for "shirt"
        // Must have word boundary "shirt" or "shirts" and NOT be exclusively a "t-shirt" / "tee"
        const hasShirtWord = /\bshirts?\b/i.test(fullTaxonomy);
        const isExclusivelyTshirt = /\b(t-?shirt|tee|tshirt|t-shirts|tees|tshirts)\b/i.test(prodCatLower) ||
                                    (/\b(t-?shirt|tee|tshirt|tees)\b/i.test(prodTitleLower) && !/\b(linen shirt|cotton shirt|printed shirt|oxford shirt|embroidered shirt|sleeve shirt|formal shirt|casual shirt)\b/i.test(prodTitleLower));
        
        // Reject if it's pants, dress, saree, shorts, or exclusively a t-shirt
        const isOtherType = /\b(pant|pants|jogger|joggers|shorts|dress|dresses|saree|sari|kurta|kurti|hoodie|jacket|shoes|sneakers|visor|balaclava)\b/i.test(prodCatLower) && !/\bshirts?\b/i.test(prodCatLower);

        if (!hasShirtWord || isExclusivelyTshirt || isOtherType) {
          return {
            isValid: false,
            failureReason: `Expected product type "Shirt", got "${product.category || product.title}"`,
            failedConstraint: `category: Shirt`
          };
        }
      } else if (isReqTshirt) {
        // Query specifically asked for "t-shirt" or "tee"
        const hasTshirtWord = /\b(t-?shirt|tee|tshirt|t-shirts|tees|tshirts)\b/i.test(fullTaxonomy);
        if (!hasTshirtWord) {
          return {
            isValid: false,
            failureReason: `Expected product type "T-Shirt", got "${product.category || product.title}"`,
            failedConstraint: `category: T-Shirt`
          };
        }
      } else {
        // Arbitrary generic category / product type precision
        const reqStem = reqCatLower.replace(/s$/, '');
        const reqRegex = new RegExp(`\\b${escapeRegex(reqStem)}s?\\b`, 'i');
        const matchesCat = reqRegex.test(fullTaxonomy);

        if (!matchesCat) {
          return {
            isValid: false,
            failureReason: `Category mismatch: expected "${requiredCategory}", got "${product.category}"`,
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
      const prodTitleLower = (product.title || '').toLowerCase().trim();

      const brandRegex = new RegExp(`\\b${escapeRegex(brandLower)}\\b`, 'i');
      if (!brandRegex.test(prodBrandLower) && !brandRegex.test(prodTitleLower)) {
        return {
          isValid: false,
          failureReason: `Brand mismatch: expected "${requiredBrand}"`,
          failedConstraint: `brand: ${requiredBrand}`
        };
      }
    }

    // -------------------------------------------------------------
    // 5. Material Match Check
    // -------------------------------------------------------------
    const requiredMaterial = plan.extracted_filters.material;
    if (requiredMaterial) {
      const matLower = requiredMaterial.toLowerCase().trim();
      const matRegex = new RegExp(`\\b${escapeRegex(matLower)}\\b`, 'i');
      const allText = `${product.title} ${product.description || ''} ${(product.subcategories || []).join(' ')} ${JSON.stringify(product.attributes || {})}`.toLowerCase();

      if (!matRegex.test(allText)) {
        return {
          isValid: false,
          failureReason: `Material mismatch: expected "${requiredMaterial}"`,
          failedConstraint: `material: ${requiredMaterial}`
        };
      }
    }

    // -------------------------------------------------------------
    // 6. Variant-Aware Multi-Attribute Consistency Evaluation
    // -------------------------------------------------------------
    const variantConstraints = plan.hard_constraints.filter(c => c.is_variant_level && c.is_hard);
    const hasVariantConstraints = variantConstraints.length > 0;

    const variants = product.variants && product.variants.length > 0 ? product.variants : [];

    if (variants.length > 0) {
      // Must find AT LEAST ONE single variant that satisfies ALL variant-level constraints simultaneously
      let matchingVariant: AIModeProductVariant | null = null;
      let firstFailureReason = '';
      let firstFailedConstraint = '';

      for (const variant of variants) {
        let variantPassed = true;

        for (const constraint of variantConstraints) {
          const evalRes = this.evaluateVariantConstraint(variant, product, constraint);
          if (!evalRes.pass) {
            variantPassed = false;
            if (!firstFailureReason) {
              firstFailureReason = evalRes.reason || `Variant violates constraint ${constraint.field}`;
              firstFailedConstraint = `${constraint.field}: ${JSON.stringify(constraint.value)}`;
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
          failureReason: firstFailureReason || `No single variant satisfies all combined variant constraints simultaneously`,
          failedConstraint: firstFailedConstraint || variantConstraints.map(c => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`).join(' AND ')
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
  ): { pass: boolean; reason?: string } {
    const { field, operator, value } = constraint;

    // 1. Price
    if (field === 'price') {
      const effectivePrice = typeof variant.price === 'number' && variant.price > 0 ? variant.price : parent.price;
      if (typeof effectivePrice !== 'number') return { pass: false, reason: 'Invalid price' };

      const numVal = Number(value);
      if (operator === '<=' && !(effectivePrice <= numVal)) {
        return { pass: false, reason: `Variant price ₹${effectivePrice} exceeds maximum ₹${numVal}` };
      }
      if (operator === '>=' && !(effectivePrice >= numVal)) {
        return { pass: false, reason: `Variant price ₹${effectivePrice} is below minimum ₹${numVal}` };
      }
      if (operator === '<' && !(effectivePrice < numVal)) {
        return { pass: false, reason: `Variant price ₹${effectivePrice} is not less than ₹${numVal}` };
      }
      if (operator === '>' && !(effectivePrice > numVal)) {
        return { pass: false, reason: `Variant price ₹${effectivePrice} is not greater than ₹${numVal}` };
      }
      if (operator === '=' && !(effectivePrice === numVal)) {
        return { pass: false, reason: `Variant price ₹${effectivePrice} does not match ₹${numVal}` };
      }
      return { pass: true };
    }

    // 2. Availability / In Stock
    if (field === 'in_stock') {
      const isAvailable = Boolean(variant.in_stock);
      if (!isAvailable) {
        return { pass: false, reason: 'Variant is out of stock' };
      }
      return { pass: true };
    }

    // 3. Color (Variant-level with Color Family support)
    if (field === 'color') {
      const expectedColor = String(value).toLowerCase().trim();
      const colorFamily = COLOR_FAMILIES[expectedColor] || [expectedColor];

      const vTitle = (variant.title || '').toLowerCase();
      const vAttrs = JSON.stringify(variant.attributes || {}).toLowerCase();
      const vText = `${vTitle} ${vAttrs}`;

      const parentTitle = (parent.title || '').toLowerCase();
      const parentAttrs = JSON.stringify(parent.attributes || {}).toLowerCase();
      const parentTags = (parent.subcategories || []).map(t => t.toLowerCase()).join(' ');
      const parentText = `${parentTitle} ${parentTags} ${parentAttrs}`;

      const matchesVariant = colorFamily.some(c => {
        const cRegex = new RegExp(`\\b${escapeRegex(c)}\\b`, 'i');
        return cRegex.test(vText);
      });

      const matchesParent = colorFamily.some(c => {
        const cRegex = new RegExp(`\\b${escapeRegex(c)}\\b`, 'i');
        return cRegex.test(parentText);
      });

      if (!matchesVariant && !matchesParent) {
        return { pass: false, reason: `Variant color does not match expected color "${expectedColor}"` };
      }
      return { pass: true };
    }

    // 4. Size (Word Boundary Matching)
    if (field === 'size') {
      const expectedSize = String(value).toUpperCase().trim();
      const vTitle = (variant.title || '').toUpperCase().trim();
      const vSizeAttr = (variant.attributes?.size || variant.attributes?.Size || '').toUpperCase().trim();
      const parentSizeAttr = (parent.attributes?.size || parent.attributes?.Size || '').toUpperCase().trim();

      const sizeRegex = new RegExp(`(^|\\b|\\s)${escapeRegex(expectedSize)}(\\b|\\s|$)`, 'i');
      const matchesSize = sizeRegex.test(vTitle) || sizeRegex.test(vSizeAttr) || sizeRegex.test(parentSizeAttr);

      if (!matchesSize) {
        return { pass: false, reason: `Variant size does not match expected size "${expectedSize}"` };
      }
      return { pass: true };
    }

    // 5. Custom Dynamic Variant Attributes (e.g. storage, ram, fit, collar, sleeve)
    const attrVal = variant.attributes?.[field] || parent.attributes?.[field];
    if (attrVal) {
      const valStr = String(attrVal).toLowerCase().trim();
      const expectedStr = String(value).toLowerCase().trim();
      if (operator === '=' && valStr !== expectedStr && !valStr.includes(expectedStr)) {
        return { pass: false, reason: `Attribute ${field} mismatch: expected ${expectedStr}, got ${valStr}` };
      }
      if (operator === 'CONTAINS' && !valStr.includes(expectedStr)) {
        return { pass: false, reason: `Attribute ${field} does not contain ${expectedStr}` };
      }
      return { pass: true };
    }

    // 6. Generic string token search in variant title
    const vTitleLower = (variant.title || '').toLowerCase();
    const expectedLower = String(value).toLowerCase().trim();
    if (vTitleLower.includes(expectedLower)) {
      return { pass: true };
    }

    return { pass: true };
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
      const numVal = Number(value);
      if (operator === '<=') return price <= numVal;
      if (operator === '>=') return price >= numVal;
      if (operator === '<') return price < numVal;
      if (operator === '>') return price > numVal;
      if (operator === '=') return price === numVal;
      return true;
    }

    if (field === 'in_stock') {
      return Boolean(parent.in_stock);
    }

    if (field === 'color') {
      const expectedColor = String(value).toLowerCase().trim();
      const colorFamily = COLOR_FAMILIES[expectedColor] || [expectedColor];
      const allText = `${parent.title} ${parent.description || ''} ${(parent.subcategories || []).join(' ')} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
      return colorFamily.some(c => new RegExp(`\\b${escapeRegex(c)}\\b`, 'i').test(allText));
    }

    if (field === 'size') {
      const expectedSize = String(value).toUpperCase().trim();
      const allText = `${parent.title} ${JSON.stringify(parent.attributes || {})}`.toUpperCase();
      const sizeRegex = new RegExp(`(^|\\b|\\s)${escapeRegex(expectedSize)}(\\b|\\s|$)`, 'i');
      return sizeRegex.test(allText);
    }

    const allText = `${parent.title} ${parent.description || ''} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
    const expected = String(value).toLowerCase().trim();
    return allText.includes(expected);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
