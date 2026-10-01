import { commerceEngine } from '@/lib/commerce';
import { db } from '@/lib/db';

export class AIModeCartAdapter {
  public static async addToCart(params: {
    workspaceId?: string;
    cart_id?: string;
    product_id: string;
    variant_id?: string;
    quantity?: number;
  }) {
    const prod = db.commerce_products.find(p => p.id === params.product_id);
    const targetWs = prod?.workspace_id || params.workspaceId || 'ws_acme_corp';

    return await commerceEngine.addToCart(
      targetWs,
      params.cart_id || 'guest_cart',
      {
        productId: params.product_id,
        variantId: params.variant_id,
        quantity: params.quantity || 1
      }
    );
  }

  public static async getCart(workspaceId?: string, cartId?: string) {
    return await commerceEngine.getCart(
      workspaceId || 'ws_acme_corp',
      cartId || 'guest_cart'
    );
  }
}


