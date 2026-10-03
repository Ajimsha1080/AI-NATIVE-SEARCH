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
    
    // Convert to normalized AIModeProduct schema
    return rawProducts.map(p => ({
      id: p.id,
      title: p.title,
      handle: p.id,
      description: p.description || '',
      price: p.price,
      sale_price: typeof p.compare_at_price === 'number' && p.compare_at_price > 0 ? p.compare_at_price : undefined,
      currency: p.currency || 'INR',
      category: p.category || 'General',
      subcategories: p.tags || [],
      brand: p.attributes?.brand || 'Merchant',
      images: p.images || [],
      in_stock: p.in_stock ?? true,
      variants: (p.variants || []).map(v => ({
        id: v.id,
        title: v.title,
        price: v.price,
        in_stock: (v.inventory_quantity ?? 1) > 0,
        attributes: v.attributes || {}
      })),
      attributes: {
        ...(p.attributes || {}),
        category: p.category || '',
      },
      source_url: p.source_url || `/products/${p.id}`
    }));
  }

  public static getProductById(id: string): AIModeProduct | null {
    const products = this.getProducts();
    return products.find(p => p.id === id) || null;
  }
}
