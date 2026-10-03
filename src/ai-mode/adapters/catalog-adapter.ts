import { db } from '@/lib/db';
import { AIModeProduct } from '../types';

const KNOWN_COLORS = [
  'black', 'white', 'red', 'green', 'yellow', 'blue', 'brown', 'grey', 'gray',
  'pink', 'purple', 'emerald', 'maroon', 'beige', 'navy', 'orange', 'gold',
  'silver', 'olive', 'cream', 'burgundy', 'crimson', 'teal', 'violet', 'indigo'
];

export class AIModeCatalogAdapter {
  public static getProducts(workspaceId?: string): AIModeProduct[] {
    let rawProducts = db.commerce_products || [];
    if (workspaceId) {
      const filtered = rawProducts.filter(p => p.workspace_id === workspaceId);
      if (filtered.length > 0) {
        rawProducts = filtered;
      }
    }
    
    // Convert to normalized AIModeProduct schema
    return rawProducts.map(p => {
      const parentAttrs: Record<string, string> = { ...(p.attributes || {}) };
      const titleLower = (p.title || '').toLowerCase();

      // Normalize color on parent if present in title
      if (!parentAttrs.color) {
        for (const col of KNOWN_COLORS) {
          if (new RegExp(`\\b${col}\\b`, 'i').test(titleLower)) {
            parentAttrs.color = col.charAt(0).toUpperCase() + col.slice(1);
            break;
          }
        }
      }

      // Normalize audience on parent if present in title/tags
      if (!parentAttrs.audience) {
        const fullText = `${titleLower} ${(p.tags || []).join(' ').toLowerCase()}`;
        if (/\b(?:women|womens|female|ladies|lady|girl|girls)\b/i.test(fullText)) {
          parentAttrs.audience = 'women';
        } else if (/\b(?:men|mens|male|gent|gents|boy|boys)\b/i.test(fullText)) {
          parentAttrs.audience = 'men';
        } else if (/\b(?:kids|kid|child|children|baby|toddler)\b/i.test(fullText)) {
          parentAttrs.audience = 'kids';
        }
      }

      return {
        id: p.id,
        title: p.title,
        handle: p.id,
        description: p.description || '',
        product_type: p.category || 'General',
        price: p.price,
        sale_price: p.compare_at_price,
        currency: p.currency || 'INR',
        category: p.category || 'General',
        subcategories: p.tags || [],
        brand: p.attributes?.brand || 'Merchant',
        audience: parentAttrs.audience || p.attributes?.gender || p.attributes?.audience,
        images: p.images || [],
        in_stock: p.in_stock ?? true,
        variants: (p.variants || []).map(v => {
          const varAttrs: Record<string, string> = { ...(v.attributes || {}) };
          const vTitle = (v.title || '').trim();

          // Infer size if not set
          if (!varAttrs.size && /^(?:xxxl|xxl|xl|xs|[smlx]|[0-9]{1,2})$/i.test(vTitle)) {
            varAttrs.size = vTitle.toUpperCase();
          }

          // If variant doesn't have color, inherit from parent attributes if parent title had explicit color
          if (!varAttrs.color && parentAttrs.color) {
            varAttrs.color = parentAttrs.color;
          }

          return {
            id: v.id,
            title: v.title,
            price: typeof v.price === 'number' && v.price > 0 ? v.price : p.price,
            in_stock: (v.inventory_quantity ?? 1) > 0,
            attributes: varAttrs
          };
        }),
        attributes: {
          ...parentAttrs,
          category: p.category || '',
        },
        source_url: p.source_url || `/products/${p.id}`
      };
    });
  }

  public static getProductById(id: string): AIModeProduct | null {
    const products = this.getProducts();
    return products.find(p => p.id === id) || null;
  }
}
