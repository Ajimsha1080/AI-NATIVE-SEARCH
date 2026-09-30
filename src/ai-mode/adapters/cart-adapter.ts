import { db } from '@/lib/db';
import { CommerceCart, CommerceProduct } from '@/types';
import { CatalogAdapter } from './catalog-adapter';

export class CartAdapter {
  /**
   * Safely adds an item to the session cart.
   */
  public static addToCart(
    workspaceId: string,
    sessionId: string,
    productId: string,
    quantity: number = 1
  ): { success: boolean; cart?: CommerceCart; product?: CommerceProduct; error?: string } {
    const product = CatalogAdapter.getProductById(productId, workspaceId);
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    let cart = db.commerce_carts.find(c => c.workspace_id === workspaceId && c.customer_id === sessionId);
    if (!cart) {
      cart = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspace_id: workspaceId,
        customer_id: sessionId,
        items: [],
        discount_amount: 0,
        subtotal: 0,
        total: 0,
        currency: product.currency || 'USD',
        updated_at: new Date().toISOString()
      };
      db.commerce_carts.push(cart);
    }

    const existingItem = cart.items.find(i => i.product_id === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        product_id: productId,
        quantity,
        price: product.price,
        title: product.title,
        image: product.images?.[0]
      });
    }

    cart.subtotal = cart.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    cart.total = Math.max(0, cart.subtotal - (cart.discount_amount || 0));
    cart.updated_at = new Date().toISOString();

    db.scheduleSave();
    return { success: true, cart, product };
  }

  /**
   * Retrieves current cart for a session.
   */
  public static getCart(workspaceId: string, sessionId: string): CommerceCart | null {
    return db.commerce_carts.find(c => c.workspace_id === workspaceId && c.customer_id === sessionId) || null;
  }
}
