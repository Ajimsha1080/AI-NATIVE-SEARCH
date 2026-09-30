import { db } from '@/lib/db';
import { CommerceProduct } from '@/types';

export class CatalogAdapter {
  /**
   * Safely retrieves all catalog products for a given workspace without altering existing state.
   */
  public static getProductsByWorkspace(workspaceId: string): CommerceProduct[] {
    return db.commerce_products.filter(p => p.workspace_id === workspaceId);
  }

  /**
   * Safely retrieves a specific product by ID and workspace.
   */
  public static getProductById(productId: string, workspaceId: string): CommerceProduct | undefined {
    return db.commerce_products.find(p => p.id === productId && p.workspace_id === workspaceId);
  }

  /**
   * Returns available categories, price ranges, and brands from the active catalog.
   */
  public static getCatalogMetadata(workspaceId: string): {
    categories: string[];
    brands: string[];
    priceRange: { min: number; max: number };
    totalProducts: number;
  } {
    const products = this.getProductsByWorkspace(workspaceId);
    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    const brands = Array.from(new Set(products.map(p => (p as any).brand).filter(Boolean)));
    const prices = products.map(p => p.price).filter(p => typeof p === 'number');
    
    return {
      categories,
      brands,
      priceRange: {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0
      },
      totalProducts: products.length
    };
  }
}
