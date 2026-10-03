import { AIModeProduct } from '../types';

export interface CatalogSchemaSnapshot {
  categories: Set<string>;
  productTypes: Set<string>;
  brands: Set<string>;
  tags: Set<string>;
  attributeKeys: Set<string>;
  attributeValues: Map<string, Set<string>>;
  minPrice: number;
  maxPrice: number;
  currency: string;
}

export class CatalogIntrospector {
  private static cachedSchemas = new Map<string, { schema: CatalogSchemaSnapshot; timestamp: number }>();
  private static CACHE_TTL_MS = 60 * 1000; // 1 minute cache

  public static introspect(products: AIModeProduct[], cacheKey = 'default'): CatalogSchemaSnapshot {
    const cached = this.cachedSchemas.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.schema;
    }

    const categories = new Set<string>();
    const productTypes = new Set<string>();
    const brands = new Set<string>();
    const tags = new Set<string>();
    const attributeKeys = new Set<string>();
    const attributeValues = new Map<string, Set<string>>();

    let minPrice = Infinity;
    let maxPrice = 0;
    let currency = 'INR';

    for (const p of products) {
      if (typeof p.price === 'number') {
        if (p.price < minPrice) minPrice = p.price;
        if (p.price > maxPrice) maxPrice = p.price;
      }
      if (p.currency) currency = p.currency;

      if (p.category) {
        categories.add(p.category.trim());
      }
      if (p.product_type) {
        productTypes.add(p.product_type.trim());
      }
      if (p.brand) {
        brands.add(p.brand.trim());
      }

      for (const t of (p.subcategories || p.tags || [])) {
        if (t) tags.add(t.trim().toLowerCase());
      }

      // Introspect parent custom attributes (excluding top-level schema fields)
      if (p.attributes && typeof p.attributes === 'object') {
        for (const [k, v] of Object.entries(p.attributes)) {
          const keyNorm = k.toLowerCase().trim();
          const valNorm = String(v).toLowerCase().trim();
          if (!keyNorm || !valNorm || ['category', 'product_type', 'brand'].includes(keyNorm)) continue;
          attributeKeys.add(keyNorm);
          if (!attributeValues.has(keyNorm)) {
            attributeValues.set(keyNorm, new Set());
          }
          attributeValues.get(keyNorm)!.add(valNorm);
        }
      }

      // Introspect variant attributes
      for (const v of (p.variants || [])) {
        if (typeof v.price === 'number') {
          if (v.price < minPrice) minPrice = v.price;
          if (v.price > maxPrice) maxPrice = v.price;
        }

        if (v.attributes && typeof v.attributes === 'object') {
          for (const [k, val] of Object.entries(v.attributes)) {
            const keyNorm = k.toLowerCase().trim();
            const valNorm = String(val).toLowerCase().trim();
            if (!keyNorm || !valNorm) continue;
            attributeKeys.add(keyNorm);
            if (!attributeValues.has(keyNorm)) {
              attributeValues.set(keyNorm, new Set());
            }
            attributeValues.get(keyNorm)!.add(valNorm);

            // Infer standard dimensions (e.g. size, color) if key hints at it
            if (['option1', 'option2', 'option3'].includes(keyNorm)) {
              // Also store in general token dictionary
              if (!attributeValues.has('variant_option')) {
                attributeValues.set('variant_option', new Set());
              }
              attributeValues.get('variant_option')!.add(valNorm);
            }
          }
        }
      }
    }

    const schema: CatalogSchemaSnapshot = {
      categories,
      productTypes,
      brands,
      tags,
      attributeKeys,
      attributeValues,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice,
      currency
    };

    this.cachedSchemas.set(cacheKey, { schema, timestamp: Date.now() });
    return schema;
  }

  /**
   * Clear schema cache (e.g. when crawler adds new products)
   */
  public static invalidateCache(cacheKey?: string) {
    if (cacheKey) {
      this.cachedSchemas.delete(cacheKey);
    } else {
      this.cachedSchemas.clear();
    }
  }
}
