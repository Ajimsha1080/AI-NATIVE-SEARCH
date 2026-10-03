import { AIModeProduct, AIModeProductVariant, AIModeSearchPlan, SearchConstraint } from '../types';

export interface EvaluationResult {
  isValid: boolean;
  matchingVariantId?: string;
  failureReason?: string;
  failedConstraint?: string;
}

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
        const exclRegex = new RegExp(`\\b${escapeRegex(exclLower)}\\b`, 'i');
        if (exclRegex.test(allText)) {
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
      const tagsLower = (product.subcategories || []).map(t => t.toLowerCase());
      const allProductText = `${titleLower} ${descLower} ${catLower} ${tagsLower.join(' ')}`;

      const isExplicitlyWomen = /\b(women|woman|womens|women's|female|ladies|lady|girl|girls|saree|sarees|bow|bows|hair|scrunchie|scrunchies|dress|dresses|kurti|kurtis|skirt|skirts|blouse)\b/i.test(allProductText);
      const isExplicitlyMen = (/\b(men|mens|men's|male|man|guys|boy|boys)\b/i.test(allProductText) || tagsLower.includes('men') || descLower.includes('for men') || descLower.includes("men's")) && !isExplicitlyWomen;
      const isUnisex = /\b(unisex|couple|combo|oversized|streetwear|tee|t-shirt|hoodie|jacket)\b/i.test(allProductText);

      if (targetGender === 'women' && isExplicitlyMen && !isExplicitlyWomen && !isUnisex) {
        return {
          isValid: false,
          failureReason: `Product is for men, user requested women's collection`,
          failedConstraint: 'gender: women'
        };
      }

      if (targetGender === 'men' && isExplicitlyWomen && !isUnisex) {
        return {
          isValid: false,
          failureReason: `Product is for women, user requested men's collection`,
          failedConstraint: 'gender: men'
        };
      }

      if (targetGender === 'kids') {
        const isKids = /\b(kids?|children|child|baby|toddler|boy|girl)\b/i.test(allProductText);
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
    const requiredCategory = plan.extracted_filters.category;
    if (requiredCategory) {
      const catLower = requiredCategory.toLowerCase();
      const prodCatLower = (product.category || '').toLowerCase();
      const prodTitleLower = (product.title || '').toLowerCase();
      const prodTagsLower = (product.subcategories || []).map(t => t.toLowerCase());

      const matchesCategory = prodCatLower.includes(catLower) || 
                              prodTitleLower.includes(catLower) || 
                              prodTagsLower.some(t => t.includes(catLower));

      if (!matchesCategory) {
        return {
          isValid: false,
          failureReason: `Category mismatch: expected "${requiredCategory}", got "${product.category}"`,
          failedConstraint: `category: ${requiredCategory}`
        };
      }
    }

    // -------------------------------------------------------------
    // 4. Brand Match Check
    // -------------------------------------------------------------
    const requiredBrand = plan.extracted_filters.brand;
    if (requiredBrand) {
      const brandLower = requiredBrand.toLowerCase();
      const prodBrandLower = (product.brand || product.attributes?.brand || '').toLowerCase();
      const prodTitleLower = (product.title || '').toLowerCase();

      if (!prodBrandLower.includes(brandLower) && !prodTitleLower.includes(brandLower)) {
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
          break; // Found a valid variant that satisfies all constraints simultaneously
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

    // Price
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

    // Availability
    if (field === 'in_stock') {
      return Boolean(variant.in_stock);
    }

    // Color
    if (field === 'color') {
      const expectedColor = String(value).toLowerCase().trim();
      const variantText = `${variant.title} ${JSON.stringify(variant.attributes || {})}`.toLowerCase();
      const parentColor = `${parent.title} ${parent.description || ''} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
      return variantText.includes(expectedColor) || parentColor.includes(expectedColor);
    }

    // Size
    if (field === 'size') {
      const expectedSize = String(value).toLowerCase().trim();
      const variantText = `${variant.title} ${JSON.stringify(variant.attributes || {})}`.toLowerCase();
      const parentSize = `${parent.title} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
      
      const sizeRegex = new RegExp(`\\b${escapeRegex(expectedSize)}\\b`, 'i');
      return sizeRegex.test(variantText) || sizeRegex.test(parentSize);
    }

    // Custom Variant Attributes (e.g. material, ram, storage, fit)
    const attrVal = variant.attributes?.[field] || parent.attributes?.[field];
    if (attrVal) {
      const valStr = String(attrVal).toLowerCase().trim();
      const expectedStr = String(value).toLowerCase().trim();
      if (operator === '=') return valStr === expectedStr || valStr.includes(expectedStr);
      if (operator === 'CONTAINS') return valStr.includes(expectedStr);
    }

    // General string match in variant title
    const vTitleLower = (variant.title || '').toLowerCase();
    const expectedLower = String(value).toLowerCase().trim();
    return vTitleLower.includes(expectedLower);
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

    const allText = `${parent.title} ${parent.description || ''} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
    const expected = String(value).toLowerCase().trim();
    return allText.includes(expected);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
