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
      
      const colorSynonyms: Record<string, string[]> = {
        red: ['red', 'maroon', 'wine', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'scarlet'],
        blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sapphire'],
        green: ['green', 'emerald', 'olive', 'mint', 'sage', 'forest'],
        black: ['black', 'charcoal', 'jet', 'onyx'],
        white: ['white', 'off-white', 'ivory', 'cream'],
        yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon'],
        brown: ['brown', 'coffee', 'tan', 'mocha', 'chocolate'],
        purple: ['purple', 'violet', 'lavender', 'magenta', 'lilac', 'plum'],
        pink: ['pink', 'rose', 'blush', 'coral', 'fuchsia'],
        orange: ['orange', 'tangerine', 'peach', 'terracotta']
      };

      for (const exclusion of plan.exclusions) {
        const exclLower = exclusion.toLowerCase().trim();
        const family = colorSynonyms[exclLower] || [exclLower];
        const exclRegex = new RegExp(`\\b(${family.map(escapeRegex).join('|')})\\b`, 'i');
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

      // Explicit Women indicators
      const isExplicitlyWomen = /\b(women|woman|womens|women's|female|ladies|lady|girl|girls|saree|sarees|bow|bows|scrunchie|scrunchies|dress|dresses|kurti|kurtis|skirt|skirts|blouse)\b/i.test(allProductText) ||
                                tagsLower.some(t => /\b(women|womens|women's|saree|sarees|kurti|kurtis|scrunchie|bow)\b/i.test(t)) ||
                                catLower.includes('saree') || catLower.includes('women');

      // Explicit Men indicators
      const isExplicitlyMen = /\b(men|mens|men's|male|man|guys|boy|boys|father)\b/i.test(allProductText) || 
                              tagsLower.some(t => /\b(men|mens|men's|men shirt)\b/i.test(t)) || 
                              /\b(for men|men's collection|men shirt)\b/i.test(descLower) || 
                              /\b(for men|men's|men shirt)\b/i.test(titleLower) ||
                              catLower.includes('men');

      // Strict Unisex indicator (ONLY if explicitly designated unisex apparel, never just a combo tag)
      const isExplicitlyUnisex = /\b(unisex|all\s+genders?)\b/i.test(allProductText) ||
                                 tagsLower.includes('unisex');

      const isComboQuery = /\b(couple|combo|box|bundle|matching|pair|set)\b/i.test(plan.original_query);
      const isProductCombo = catLower.includes('combo') || 
                             catLower.includes('box') || 
                             catLower.includes('couple') || 
                             titleLower.includes('couple combo') || 
                             titleLower.includes('combo box') || 
                             titleLower.includes('shirt and saree combo');

      if (targetGender === 'women') {
        // Disqualify couple combo bundles from pure women searches unless user explicitly asked for combos
        if (isProductCombo && !isComboQuery) {
          return {
            isValid: false,
            failureReason: `Product is a couple combo bundle, user requested pure women's collection`,
            failedConstraint: 'gender: women'
          };
        }

        // Strict affirmative filter: For women's search, product MUST be explicitly for women or unisex
        if (!isExplicitlyWomen && !isExplicitlyUnisex) {
          return {
            isValid: false,
            failureReason: `Product is not part of the women's collection`,
            failedConstraint: 'gender: women'
          };
        }
        // If it is explicitly for men and NOT explicitly for women -> REJECT
        if (isExplicitlyMen && !isExplicitlyWomen) {
          return {
            isValid: false,
            failureReason: `Product is for men, user requested women's collection`,
            failedConstraint: 'gender: women'
          };
        }
      }

      if (targetGender === 'men') {
        // Disqualify couple combo bundles from pure men searches unless user explicitly asked for combos
        if (isProductCombo && !isComboQuery) {
          return {
            isValid: false,
            failureReason: `Product is a couple combo bundle, user requested pure men's collection`,
            failedConstraint: 'gender: men'
          };
        }

        // Strict affirmative filter: For men's search, product MUST NOT be exclusively for women
        if (isExplicitlyWomen && !isExplicitlyMen && !isExplicitlyUnisex) {
          return {
            isValid: false,
            failureReason: `Product is for women, user requested men's collection`,
            failedConstraint: 'gender: men'
          };
        }
        if (tagsLower.includes('women') && !tagsLower.includes('men') && !isExplicitlyUnisex) {
          return {
            isValid: false,
            failureReason: `Product is categorized under Women`,
            failedConstraint: 'gender: men'
          };
        }
      }

      if (targetGender === 'kids') {
        const isKids = /\b(kids?|children|child|baby|toddler|boy|girl)\b/i.test(allProductText) ||
                       tagsLower.some(t => /\b(kids?|child|baby)\b/i.test(t));
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
      const catLower = requiredCategory.toLowerCase().trim();
      const rootCat = catLower.replace(/(es|s)$/i, '');

      const prodCatLower = (product.category || '').toLowerCase();
      const prodTitleLower = (product.title || '').toLowerCase();
      const prodTagsLower = (product.subcategories || []).map(t => t.toLowerCase());

      const isComboQuery = /\b(couple|combo|box|bundle|matching|pair|set)\b/i.test(plan.original_query);
      const isProductCombo = prodCatLower.includes('combo') || 
                             prodCatLower.includes('box') || 
                             prodCatLower.includes('couple') || 
                             prodTitleLower.includes('couple combo') || 
                             prodTitleLower.includes('combo box') || 
                             prodTitleLower.includes('shirt and saree combo');

      // Standalone single-category precision (e.g. "saree", "shirt", "pant"):
      // If user did NOT ask for a combo, do NOT match combo bundles
      if (isProductCombo && !isComboQuery && ['saree', 'shirt', 'dress', 'kurti', 'pant', 'pants', 'jogger', 'joggers', 't-shirt', 'shoe', 'shoes', 'bag', 'bags'].includes(rootCat)) {
        return {
          isValid: false,
          failureReason: `Category mismatch: expected standalone "${requiredCategory}", but product is a combo bundle`,
          failedConstraint: `category: ${requiredCategory}`
        };
      }

      // Category synonym / family dictionary
      const categorySynonyms: Record<string, string[]> = {
        dress: ['dress', 'dresses', 'saree', 'sarees', 'kurti', 'kurtis', 'gown', 'gowns', 'frock', 'frocks', 'skirt', 'skirts', 'suit', 'lehenga', 'sari'],
        saree: ['saree', 'sarees', 'sari', 'saris'],
        kurti: ['kurti', 'kurtis', 'kurta', 'kurtas', 'suit', 'suits'],
        shirt: ['shirt', 'shirts', 'tshirt', 't-shirt', 'tee', 'tees', 'top', 'tops', 'polo'],
        't-shirt': ['tshirt', 't-shirt', 't-shirts', 'tshirts', 'tee', 'tees', 'top'],
        joggers: ['jogger', 'joggers', 'pant', 'pants', 'trouser', 'trousers', 'trackpant', 'trackpants'],
        pants: ['pant', 'pants', 'trouser', 'trousers', 'jeans', 'jogger', 'joggers', 'trackpant'],
        shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'sandal', 'sandals', 'boot', 'boots'],
        bags: ['bag', 'bags', 'backpack', 'backpacks', 'handbag', 'handbags', 'tote', 'wallet'],
        sleeves: ['sleeve', 'sleeves', 'laptop sleeve', 'cover', 'case'],
        accessories: ['accessory', 'accessories', 'scrunchie', 'scrunchies', 'bow', 'bows', 'belt', 'belts', 'cap', 'caps', 'hat', 'hats']
      };

      const synonymList = categorySynonyms[catLower] || categorySynonyms[rootCat] || [catLower, rootCat];
      const synonymRegex = new RegExp(`\\b(${synonymList.map(s => escapeRegex(s.replace(/(es|s)$/i, '')) + '(es|s)?').join('|')})\\b`, 'i');

      const matchesCategory = synonymRegex.test(prodCatLower) || 
                              synonymRegex.test(prodTitleLower) || 
                              prodTagsLower.some(t => synonymRegex.test(t));

      if (!matchesCategory) {
        return {
          isValid: false,
          failureReason: `Category mismatch: expected "${requiredCategory}", got "${product.category || product.title}"`,
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

    // Color (Strict Word-Boundary & Synonym Aware)
    if (field === 'color') {
      const rawColor = String(value).toLowerCase().trim();
      const colorSynonyms: Record<string, string[]> = {
        red: ['red', 'maroon', 'wine', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'coral', 'scarlet'],
        blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky', 'sapphire'],
        green: ['green', 'emerald', 'olive', 'mint', 'sage', 'evergreen', 'forest', 'khaki'],
        black: ['black', 'charcoal', 'jet', 'obsidian', 'onyx', 'pitch'],
        white: ['white', 'off-white', 'off white', 'ivory', 'cream', 'snow'],
        yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon'],
        brown: ['brown', 'coffee', 'tan', 'khaki', 'mocha', 'chocolate'],
        purple: ['purple', 'violet', 'lavender', 'magenta', 'lilac', 'plum'],
        pink: ['pink', 'rose', 'blush', 'coral', 'salmon', 'fuchsia'],
        orange: ['orange', 'tangerine', 'peach', 'apricot', 'terracotta']
      };

      const colorFamily = colorSynonyms[rawColor] || [rawColor];
      const colorRegex = new RegExp(`\\b(${colorFamily.map(escapeRegex).join('|')})\\b`, 'i');

      const vAttrColor = String(variant.attributes?.color || '').toLowerCase();
      if (vAttrColor && colorRegex.test(vAttrColor)) return true;

      const vTitle = String(variant.title || '').toLowerCase();
      if (colorRegex.test(vTitle)) return true;

      const pTitle = String(parent.title || '').toLowerCase();
      const pAttrColor = String(parent.attributes?.color || '').toLowerCase();
      if (colorRegex.test(pTitle) || colorRegex.test(pAttrColor)) return true;

      return false;
    }

    // Size
    if (field === 'size') {
      const expectedSize = String(value).toLowerCase().trim();
      const variantText = `${variant.title} ${JSON.stringify(variant.attributes || {})}`.toLowerCase();
      const parentSize = `${parent.title} ${JSON.stringify(parent.attributes || {})}`.toLowerCase();
      
      const sizeRegex = new RegExp(`(^|[\\s\\-_/])${escapeRegex(expectedSize)}($|[\\s\\-_/])`, 'i');
      return sizeRegex.test(variantText) || sizeRegex.test(parentSize);
    }

    // Custom Variant Attributes (e.g. material, ram, storage, fit)
    const attrVal = variant.attributes?.[field] || parent.attributes?.[field];
    if (attrVal) {
      const valStr = String(attrVal).toLowerCase().trim();
      const expectedStr = String(value).toLowerCase().trim();
      if (operator === '=') return valStr === expectedStr || new RegExp(`\\b${escapeRegex(expectedStr)}\\b`, 'i').test(valStr);
      if (operator === 'CONTAINS') return new RegExp(`\\b${escapeRegex(expectedStr)}\\b`, 'i').test(valStr);
    }

    // General word match in variant title
    const vTitleLower = (variant.title || '').toLowerCase();
    const expectedLower = String(value).toLowerCase().trim();
    return new RegExp(`\\b${escapeRegex(expectedLower)}\\b`, 'i').test(vTitleLower);
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
      const rawColor = String(value).toLowerCase().trim();
      const colorSynonyms: Record<string, string[]> = {
        red: ['red', 'maroon', 'wine', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'coral', 'scarlet'],
        blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky', 'sapphire'],
        green: ['green', 'emerald', 'olive', 'mint', 'sage', 'evergreen', 'forest', 'khaki'],
        black: ['black', 'charcoal', 'jet', 'obsidian', 'onyx', 'pitch'],
        white: ['white', 'off-white', 'off white', 'ivory', 'cream', 'snow'],
        yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon'],
        brown: ['brown', 'coffee', 'tan', 'khaki', 'mocha', 'chocolate'],
        purple: ['purple', 'violet', 'lavender', 'magenta', 'lilac', 'plum'],
        pink: ['pink', 'rose', 'blush', 'coral', 'salmon', 'fuchsia'],
        orange: ['orange', 'tangerine', 'peach', 'apricot', 'terracotta']
      };

      const colorFamily = colorSynonyms[rawColor] || [rawColor];
      const colorRegex = new RegExp(`\\b(${colorFamily.map(escapeRegex).join('|')})\\b`, 'i');
      const pTitle = String(parent.title || '').toLowerCase();
      const pAttrColor = String(parent.attributes?.color || '').toLowerCase();
      return colorRegex.test(pTitle) || colorRegex.test(pAttrColor);
    }

    const expected = String(value).toLowerCase().trim();
    const expectedRegex = new RegExp(`\\b${escapeRegex(expected)}\\b`, 'i');
    const pTitle = (parent.title || '').toLowerCase();
    const pAttr = JSON.stringify(parent.attributes || {}).toLowerCase();
    return expectedRegex.test(pTitle) || expectedRegex.test(pAttr);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
