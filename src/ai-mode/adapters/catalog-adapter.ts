import { db } from '@/lib/db';
import { AIModeProduct } from '../types';

export class AIModeCatalogAdapter {
  public static getProducts(workspaceId?: string): AIModeProduct[] {
    let rawProducts = db.commerce_products || [];
    if (workspaceId) {
      const filtered = rawProducts.filter(p => p.workspace_id === workspaceId);
      if (filtered.length > 0) {
        rawProducts = filtered;
      }
    }
    
    // Convert to normalized AIModeProduct schema preserving all evidence
    return rawProducts.map(p => {
      const tags = p.tags || [];
      const tagsLower = tags.map(t => t.toLowerCase());
      const titleLower = (p.title || '').toLowerCase();
      
      // Infer audience if not directly provided in attributes
      let audience = p.attributes?.audience || p.attributes?.gender;
      if (!audience) {
        if (tagsLower.includes('women') || tagsLower.includes('womens') || tagsLower.includes("women's") || /\b(women|womens|women's|female|ladies)\b/i.test(titleLower)) {
          audience = 'women';
        } else if (tagsLower.includes('men') || tagsLower.includes('mens') || tagsLower.includes("men's") || /\b(men|mens|men's|male|gents)\b/i.test(titleLower)) {
          audience = 'men';
        } else if (tagsLower.includes('kids') || tagsLower.includes('children') || /\b(kids|children|toddler)\b/i.test(titleLower)) {
          audience = 'kids';
        } else if (tagsLower.includes('unisex') || /\bunisex\b/i.test(titleLower)) {
          audience = 'unisex';
        }
      }

      return {
        id: p.id,
        title: p.title,
        handle: p.id,
        description: p.description || '',
        product_type: p.product_type || p.category || 'General',
        price: p.price,
        sale_price: p.compare_at_price,
        currency: p.currency || 'INR',
        category: p.category || 'General',
        subcategories: tags,
        tags: tags,
        brand: p.attributes?.brand || 'Merchant',
        audience,
        images: p.images || [],
        in_stock: p.in_stock ?? true,
        variants: (p.variants || []).map(v => ({
          id: v.id,
          title: v.title,
          price: v.price,
          sale_price: (v as any).compare_at_price,
          in_stock: (v.inventory_quantity ?? 1) > 0,
          sku: v.sku,
          attributes: v.attributes || {}
        })),
        attributes: {
          ...(p.attributes || {}),
          category: p.category || '',
          product_type: p.product_type || p.category || '',
          ...(audience ? { audience, gender: audience } : {})
        },
        searchable_text: p.searchable_text,
        source_url: p.source_url || `/products/${p.id}`
      };
    });
  }

  public static getProductById(id: string): AIModeProduct | null {
    const products = this.getProducts();
    return products.find(p => p.id === id) || null;
  }
}

