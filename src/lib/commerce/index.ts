import { db } from '../db';
import { CommerceProduct, CommerceOrder, CommerceCart } from '@/types';

export interface ProductSearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  inStockOnly?: boolean;
}

export class LocalCommerceProvider {
  async searchProducts(workspaceId: string, params: ProductSearchParams): Promise<CommerceProduct[]> {
    let list = db.commerce_products.filter(p => p.workspace_id === workspaceId);

    if (params.query) {
      const typoMap: Record<string, string> = {
        wmoen: 'women',
        womne: 'women',
        wommen: 'women',
        womans: 'women',
        wmon: 'women',
        womem: 'women',
        prodcuts: 'products',
        prodcut: 'product',
        produts: 'products',
        produtcs: 'products',
        proucts: 'products',
        porducts: 'products',
        jaket: 'jacket',
        jakets: 'jackets',
        jakcet: 'jacket',
        jackt: 'jacket',
        sunscren: 'sunscreen',
        suncrean: 'sunscreen',
        suncream: 'sunscreen',
        suncreen: 'sunscreen',
        shrit: 'shirt',
        shrits: 'shirts',
        tshrit: 'tshirt',
        tshrits: 'tshirts',
        balclava: 'balaclava',
        balaklava: 'balaclava',
        viser: 'visor',
        visors: 'visor',
        clothe: 'clothes',
        cloths: 'clothes',
        trak: 'track',
        traking: 'tracking',
        retrn: 'return',
        ordr: 'order',
        oder: 'order',
      };

      let q = params.query.toLowerCase();
      for (const [typo, fix] of Object.entries(typoMap)) {
        q = q.replace(new RegExp(`\\b${typo}\\b`, 'gi'), fix);
      }

      const isBroadQuery = /new|latest|arrival|arrivals|product|products|item|items|catalog|collection|bestseller|trending|recommend|what do you have|what you sell|all/i.test(q);
      const stopWords = new Set(['show', 'me', 'find', 'look', 'for', 'under', 'below', 'in', 'size', 'with', 'a', 'an', 'the', 'please', 'can', 'you', 'give', 'what', 'are', 'your', 'any', 'new', 'latest', 'product', 'products', 'items', 'item', 'catalog', 'collection', 'arrivals', 'arrival']);
      const tokens = q.split(/[\s,?!]+/).filter(w => w.length > 2 && !stopWords.has(w) && isNaN(Number(w)));
      const synonyms: Record<string, string[]> = {
        men: ['mens', 'male', 'gent', 'gents'],
        mens: ['men', 'male', 'gent', 'gents'],
        women: ['womens', 'ladies', 'lady', 'female'],
        womens: ['women', 'ladies', 'lady', 'female'],
        cap: ['visor', 'hat', 'headwear'],
        caps: ['visor', 'hat', 'headwear'],
        hat: ['visor', 'cap', 'headwear'],
        hats: ['visor', 'cap', 'headwear'],
        visor: ['visor', 'hat', 'cap', 'headwear'],
        visors: ['visor', 'hat', 'cap', 'headwear'],
        balaclava: ['mask', 'face cover', 'neck gaiter'],
        mask: ['balaclava', 'face cover'],
        tee: ['tshirt', 't-shirt', 'nosweat', 'tee'],
        tees: ['tshirt', 't-shirt', 'nosweat', 'tee'],
        shirt: ['tshirt', 't-shirt', 'nosweat', 'tee'],
        shirts: ['tshirt', 't-shirt', 'nosweat', 'tee'],
        top: ['tee', 'tshirt', 'jacket'],
        tops: ['tee', 'tshirt', 'jacket'],
        hoodie: ['thermal', 'jacket', 'anti-ac'],
        hoodies: ['thermal', 'jacket', 'anti-ac'],
        jacket: ['sunscreen jacket', 'thermal', 'anti-ac'],
        jackets: ['sunscreen jacket', 'thermal', 'anti-ac'],
      };

      const demographicWords = new Set(['men', 'mens', 'male', 'gent', 'gents', 'guy', 'guys', 'women', 'womens', 'lady', 'ladies', 'female', 'girl', 'girls']);
      const productTypeTokens = tokens.filter(t => !demographicWords.has(t));

      const isMenQuery = /\b(men|mens|male|gent|gents|guy|guys)\b/i.test(q);
      const isWomenQuery = /\b(women|womens|lady|ladies|female|girl|girls)\b/i.test(q);

      const searchTypeTokens = new Set<string>(productTypeTokens);
      for (const t of productTypeTokens) {
        if (synonyms[t]) {
          synonyms[t].forEach(s => searchTypeTokens.add(s));
        }
      }

      let filtered = list.filter(p => {
        const titleLower = p.title.toLowerCase();
        const tagsLower = p.tags.map(t => t.toLowerCase());
        const descLower = p.description.toLowerCase();
        const fullText = `${titleLower} ${descLower} ${p.category.toLowerCase()} ${tagsLower.join(' ')}`;
        const wordsInText = new Set(fullText.split(/[\s,._\-/+():;]+/));

        // Demographic enforcement:
        const isWomenProduct = titleLower.includes('women') || tagsLower.includes('women') || tagsLower.includes('womens') || tagsLower.includes('female');
        if (isMenQuery && !isWomenQuery && isWomenProduct) {
          return false; // Exclude women's products for explicit men's query
        }
        if (isWomenQuery && !isMenQuery && !isWomenProduct) {
          return false; // Exclude men-only products for explicit women's query
        }

        // If no specific product type was queried (e.g. "mens products", "men collection", "all"), return all demographic-matching items
        if (searchTypeTokens.size === 0) {
          return true;
        }

        if (fullText.includes(q)) return true;

        for (const t of searchTypeTokens) {
          if (wordsInText.has(t)) return true;
          if (t.length >= 4 && fullText.includes(t)) return true;
        }
        return false;
      });

      // Demographic filter refinement:
      if (isWomenQuery) {
        const womenOnly = filtered.filter(p => {
          const tLower = p.title.toLowerCase();
          const tagsLower = p.tags.map(t => t.toLowerCase());
          return tLower.includes('women') || tagsLower.includes('women') || tagsLower.includes('womens');
        });
        if (womenOnly.length > 0) {
          filtered = womenOnly;
        }
      } else if (isMenQuery) {
        const menOnly = filtered.filter(p => {
          const tLower = p.title.toLowerCase();
          const tagsLower = p.tags.map(t => t.toLowerCase());
          return !tLower.includes('women') && !tagsLower.includes('women') && !tagsLower.includes('womens');
        });
        if (menOnly.length > 0) {
          filtered = menOnly;
        }
      }

      if (filtered.length > 0) {
        // Relevance ranking: Title matches rank higher than description matches
        filtered.sort((a, b) => {
          const score = (p: CommerceProduct) => {
            let s = 0;
            const tLower = p.title.toLowerCase();
            const dLower = p.description.toLowerCase();
            const tagsLower = p.tags.map(t => t.toLowerCase());
            for (const token of tokens) {
              if (tLower.includes(token)) s += 100;
              if (tagsLower.includes(token)) s += 50;
              if (dLower.includes(token)) s += 20;
            }
            return s;
          };
          return score(b) - score(a);
        });
        list = filtered;
      } else if (tokens.length === 0 && isBroadQuery) {
        // Pure discovery query without specific unmatched keywords -> return top catalog products
        list = list.slice(0, 4);
      } else {
        list = [];
      }
    }

    if (params.category) {
      list = list.filter(p => p.category.toLowerCase() === params.category!.toLowerCase());
    }

    if (params.minPrice !== undefined) {
      list = list.filter(p => p.price >= params.minPrice!);
    }

    if (params.maxPrice !== undefined) {
      list = list.filter(p => p.price <= params.maxPrice!);
    }

    if (params.size) {
      const sizeLower = params.size.toLowerCase();
      list = list.filter(p =>
        p.variants.some(v => v.attributes.size?.toLowerCase() === sizeLower && v.inventory_quantity > 0)
      );
    }

    if (params.color) {
      const colorLower = params.color.toLowerCase();
      list = list.filter(p =>
        p.variants.some(v => v.attributes.color?.toLowerCase().includes(colorLower))
      );
    }

    if (params.inStockOnly) {
      list = list.filter(p => p.in_stock && p.total_inventory > 0);
    }

    return list;
  }

  async getProduct(workspaceId: string, productId: string): Promise<CommerceProduct | null> {
    return db.commerce_products.find(p => p.workspace_id === workspaceId && p.id === productId) || null;
  }

  async getInventory(workspaceId: string, productId: string, variantId?: string): Promise<{
    in_stock: boolean;
    available_quantity: number;
    variants: Array<{ id: string; title: string; quantity: number }>;
  }> {
    const product = await this.getProduct(workspaceId, productId);
    if (!product) {
      return { in_stock: false, available_quantity: 0, variants: [] };
    }

    if (variantId) {
      const v = product.variants.find(item => item.id === variantId || item.attributes.size === variantId);
      if (v) {
        return {
          in_stock: v.inventory_quantity > 0,
          available_quantity: v.inventory_quantity,
          variants: [{ id: v.id, title: v.title, quantity: v.inventory_quantity }]
        };
      }
    }

    return {
      in_stock: product.in_stock && product.total_inventory > 0,
      available_quantity: product.total_inventory,
      variants: product.variants.map(v => ({ id: v.id, title: v.title, quantity: v.inventory_quantity }))
    };
  }

  maskAddress(address?: string): string {
    if (!address) return 'Address on file';
    const parts = address.split(',');
    if (parts.length > 1) {
      return `*** ${parts[0].slice(-7)}, ${parts.slice(1).join(',').trim()}`;
    }
    return `*** ${address.slice(-10)}`;
  }

  async getOrder(workspaceId: string, orderNumber: string, customerEmail?: string): Promise<CommerceOrder | null> {
    if (!customerEmail || !customerEmail.trim()) {
      return null;
    }
    const cleanNum = orderNumber.replace('#', '').trim();
    const cleanEmail = customerEmail.toLowerCase().trim();

    const order = db.commerce_orders.find(o =>
      o.workspace_id === workspaceId &&
      (o.order_number.replace('#', '') === cleanNum || o.id === orderNumber) &&
      o.customer_email.toLowerCase().trim() === cleanEmail
    );
    return order || null;
  }

  async getShippingStatus(workspaceId: string, orderNumber: string, customerEmail?: string) {
    if (!customerEmail || !customerEmail.trim()) {
      return null;
    }
    const order = await this.getOrder(workspaceId, orderNumber, customerEmail);
    if (!order) return null;

    let trackingUrl = '';
    if (order.carrier?.includes('FedEx')) {
      trackingUrl = 'https://www.fedex.com/fedextrack/?trknbr=' + order.tracking_number;
    } else if (order.carrier?.includes('UPS')) {
      trackingUrl = 'https://www.ups.com/track?tracknum=' + order.tracking_number;
    }

    return {
      order_number: order.order_number,
      status: order.status,
      carrier: order.carrier,
      tracking_number: order.tracking_number,
      tracking_url: trackingUrl,
      masked_destination: this.maskAddress(order.shipping_address),
      estimated_delivery: order.status === 'DELIVERED' ? 'Delivered on time' : 'Estimated within 2 business days'
    };
  }


  async getCart(workspaceId: string, cartId: string): Promise<CommerceCart> {
    let cart = db.commerce_carts.find(c => c.workspace_id === workspaceId && c.id === cartId);
    if (!cart) {
      cart = {
        id: cartId,
        workspace_id: workspaceId,
        items: [],
        discount_amount: 0,
        subtotal: 0,
        total: 0,
        currency: 'USD',
        updated_at: new Date().toISOString()
      };
      db.commerce_carts.push(cart);
      db.scheduleSave();
    }
    return cart;
  }

  async addToCart(workspaceId: string, cartId: string, item: {
    productId: string;
    variantId?: string;
    quantity: number;
  }): Promise<CommerceCart> {
    const cart = await this.getCart(workspaceId, cartId);
    const product = await this.getProduct(workspaceId, item.productId);
    if (!product) throw new Error('Product not found');

    const variant = product.variants.find(v => v.id === item.variantId) || product.variants[0];
    const price = variant ? variant.price : product.price;

    const existingIndex = cart.items.findIndex(
      i => i.product_id === item.productId && (!item.variantId || i.variant_id === item.variantId)
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += (item.quantity || 1);
    } else {
      cart.items.push({
        product_id: product.id,
        variant_id: variant?.id,
        title: product.title + (variant ? ' (' + variant.title + ')' : ''),
        quantity: item.quantity || 1,
        price: price,
        image: product.images[0]
      });
    }

    cart.subtotal = cart.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    cart.total = Math.max(0, cart.subtotal - cart.discount_amount);
    cart.updated_at = new Date().toISOString();

    db.scheduleSave();
    return cart;
  }

  async validateCoupon(workspaceId: string, code: string, subtotal: number) {
    const upper = code.toUpperCase().trim();
    if (upper === 'WELCOME10') {
      const discount = subtotal * 0.10;
      return { valid: true, discount_amount: discount, description: '10% New Customer Discount' };
    }
    if (upper === 'VIP20') {
      const discount = subtotal * 0.20;
      return { valid: true, discount_amount: discount, description: '20% VIP Store Discount' };
    }
    if (upper === 'FREESHIP') {
      return { valid: true, discount_amount: 5.99, description: 'Free Standard Shipping Applied' };
    }
    return { valid: false, discount_amount: 0, description: 'Invalid or expired promotional code' };
  }

  async checkReturnEligibility(workspaceId: string, orderNumber: string, productId?: string, customerEmail?: string) {
    const cleanNum = orderNumber.replace('#', '').trim();
    const order = db.commerce_orders.find(o =>
      o.workspace_id === workspaceId &&
      (o.order_number.replace('#', '') === cleanNum || o.id === orderNumber) &&
      (!customerEmail || o.customer_email.toLowerCase().trim() === customerEmail.toLowerCase().trim())
    );
    if (!order) return { eligible: false, reason: 'Order not found', return_window_days: 0 };

    if (order.status !== 'DELIVERED') {
      return { eligible: false, reason: 'Order is not marked delivered yet', return_window_days: 0 };
    }

    return {
      eligible: true,
      reason: 'Eligible for standard 7-day exchange/return with prepaid courier pickup',
      return_window_days: 7
    };
  }

  async createReturn(workspaceId: string, orderNumber: string, productId: string, reason: string) {
    const returnId = 'RET-' + Date.now().toString().slice(-6);
    return {
      success: true,
      return_id: returnId,
      return_label_url: 'https://returns.bluetyga.com/labels/' + returnId + '.pdf',
      instructions: 'Keep the item in its original packaging with tags attached. A Bluedart/Delhivery courier executive will arrive for doorstep reverse pickup.'
    };
  }
}

export const commerceEngine = new LocalCommerceProvider();
