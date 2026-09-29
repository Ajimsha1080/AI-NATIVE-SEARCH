import { db } from '../db';
import { CommerceProduct, CommerceOrder, CommerceCart } from '@/types';

export interface ProductSearchParams {
  query?: string;
  category?: string;
  gender?: 'men' | 'women' | 'unisex' | 'kids';
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  occasion?: string;
  style?: string;
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

      let q = params.query.toLowerCase().trim();
      for (const [typo, fix] of Object.entries(typoMap)) {
        q = q.replace(new RegExp(`\\b${typo}\\b`, 'gi'), fix);
      }

      const cleanQ = q.replace(/[^\w\s\-\/₹$]/g, ' ').replace(/\s+/g, ' ').trim();
      const queryTokens = cleanQ.split(/\s+/).filter(w => w.length > 1);

      // Dynamic Catalog Taxonomy Extraction (from active merchant products)
      const catalogCategories = Array.from(new Set(list.map(p => p.category.trim()).filter(Boolean)));
      const catalogTags = Array.from(new Set(list.flatMap(p => (p.tags || []).map(t => t.trim().toLowerCase())).filter(Boolean)));

      const stemWord = (word: string): string => {
        const w = word.toLowerCase().trim();
        if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
        if (w.endsWith('es') && !w.endsWith('ses') && w.length > 3) return w.slice(0, -2);
        if (w.endsWith('s') && !w.endsWith('ss') && w.length > 2) return w.slice(0, -1);
        return w;
      };

      const queryStemmed = queryTokens.map(stemWord);

      // 1. Identify Explicit Category / Product Concept Constraint
      let explicitCategoryMatch: string | null = null;

      // Check multi-word categories first (e.g. "T-Shirts", "Ceramic Planters", "Kurta Pant Combo")
      for (const cat of catalogCategories) {
        const catNorm = cat.toLowerCase().trim();
        const catStemmed = catNorm.split(/[\s\-_]+/).map(stemWord).join(' ');
        if (cleanQ.includes(catNorm) || cleanQ.includes(catStemmed)) {
          explicitCategoryMatch = cat;
          break;
        }
      }

      // Check single-word category matches
      if (!explicitCategoryMatch) {
        for (const cat of catalogCategories) {
          const catNorm = cat.toLowerCase().trim();
          const catStem = stemWord(catNorm);

          // Disambiguate compound vs base categories (e.g. "T-Shirts" vs "Shirts")
          const isTShirtCat = /t-?shirt|tee/i.test(catNorm);
          const hasTShirtToken = queryTokens.some(t => /t-?shirt|tee/i.test(t));

          if (isTShirtCat && !hasTShirtToken) continue;
          if (!isTShirtCat && /shirt/i.test(catNorm) && hasTShirtToken) continue;

          if (queryStemmed.includes(catStem) || queryTokens.includes(catNorm)) {
            explicitCategoryMatch = cat;
            break;
          }
        }
      }

      // 2. Demographic & Gender Constraints
      const isMenQuery = params.gender === 'men' || /\b(men|mens|male|gent|gents|guy|guys|brother|husband|him|father|boy)\b/i.test(cleanQ);
      const isWomenQuery = params.gender === 'women' || /\b(women|womens|lady|ladies|female|girl|girls|wife|sister|her|mother)\b/i.test(cleanQ);

      const checkIsWomenProduct = (p: CommerceProduct) => {
        const titleL = p.title.toLowerCase();
        const tagsL = (p.tags || []).map(t => t.toLowerCase()).join(' ');
        const catL = (p.category || '').toLowerCase();
        const descL = (p.description || '').toLowerCase();
        const full = `${titleL} ${tagsL} ${catL} ${descL}`;
        return full.includes('women') || full.includes('womens') || full.includes('female') ||
          full.includes('saree') || full.includes('kurta') || full.includes('kurti') ||
          full.includes('dress') || full.includes('lehenga') || full.includes('gown') ||
          full.includes('skirt') || full.includes('blouse');
      };

      // 3. General Semantic & Occasion Understanding
      const semanticUseCases: Record<string, string[]> = {
        gym: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'breathable', 'jogger', 'tee', 'performance', 'tank', 'athletic', 'workout'],
        fitness: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'breathable', 'jogger', 'tee', 'performance', 'athletic'],
        workout: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'breathable', 'jogger', 'tee', 'performance'],
        sports: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'jogger', 'tee', 'visor', 'balaclava'],
        running: ['activewear', 'nosweat', 'quick-dry', 'stretch', 'jogger', 'tee', 'visor'],
        dinner: ['shirt', 'shacket', 'kurta', 'combo', 'saree', 'palace', 'embroidered', 'corduroy', 'dress', 'elegant', 'black', 'luxe'],
        office: ['shirt', 'corduroy', 'pant', 'anti-ac', 'thermal', 'kurta', 'poplin', 'formal', 'classic', 'cotton', 'clean'],
        work: ['shirt', 'corduroy', 'pant', 'anti-ac', 'thermal', 'kurta', 'poplin', 'formal', 'classic', 'cotton'],
        casual: ['tee', 'tshirt', 'jogger', 'hoodie', 'nosweat', 'shacket', 'jacket', 'cotton', 'relaxed', 'casual', 'denim'],
        weekend: ['relaxed', 'casual', 'cotton', 'jogger', 'tee', 'hoodie', 'comfortable', 'denim'],
        trip: ['jogger', 'jacket', 'hoodie', 'tee', 'visor', 'comfort', 'cotton', 'travel'],
        wedding: ['royal', 'heritage', 'saree', 'kurta', 'combo', 'zari', 'dori', 'mandala', 'embroidered', 'festive', 'silk', 'traditional'],
        festive: ['royal', 'heritage', 'saree', 'kurta', 'combo', 'yellow floral', 'emerald', 'mandala', 'embroidered', 'festive'],
        festival: ['royal', 'heritage', 'saree', 'kurta', 'combo', 'yellow floral', 'emerald', 'mandala', 'embroidered', 'festive'],
        summer: ['sunscreen', 'ice', 'cooling', 'tee', 'nosweat', 'visor', 'balaclava', 'upf50', 'lightweight', 'breathable', 'cotton'],
        winter: ['thermal', 'anti-ac', 'fleece', 'hoodie', 'jacket', 'warm', 'insulation', 'corduroy'],
        brother: ['shirt', 'tee', 'jogger', 'jacket', 'shacket', 'corduroy', 'men'],
        wife: ['saree', 'kurta', 'combo', 'dress', 'women', 'yellow floral', 'emerald'],
        comfortable: ['nosweat', 'poplin', 'thermal', 'jogger', 'tee', 'cotton', 'relaxed', 'breathable', 'comfort'],
        comfort: ['nosweat', 'poplin', 'thermal', 'jogger', 'tee', 'cotton', 'relaxed', 'breathable', 'comfort']
      };

      const matchedSemanticTerms = new Set<string>();
      for (const [key, terms] of Object.entries(semanticUseCases)) {
        if (cleanQ.includes(key)) {
          terms.forEach(t => matchedSemanticTerms.add(t));
        }
      }

      // 4. Content Tokens
      const stopWords = new Set([
        'show', 'me', 'find', 'look', 'for', 'under', 'below', 'in', 'size', 'with', 'a', 'an', 'the',
        'please', 'can', 'you', 'give', 'what', 'are', 'your', 'any', 'new', 'latest', 'product',
        'products', 'items', 'item', 'catalog', 'collection', 'arrivals', 'arrival', 'good', 'something',
        'nice', 'need', 'want', 'buy', 'recommend', 'would', 'like', 'there', 'have', 'i', 'get', 'to',
        'some', 'of', 'and', 'or', 'is', 'it', 'this', 'that', 'from', 'best', 'top', 'do', 'help', 'choose'
      ]);
      const contentTokens = queryTokens.filter(t => !stopWords.has(t) && isNaN(Number(t)));

      // 5. Candidate Filtering
      let candidates = list.filter(p => {
        const titleL = p.title.toLowerCase();
        const tagsL = (p.tags || []).map(t => t.toLowerCase());
        const catL = (p.category || '').toLowerCase();
        const descL = (p.description || '').toLowerCase();
        const fullText = `${titleL} ${descL} ${catL} ${tagsL.join(' ')}`;

        // Demographic enforcement
        const isWomen = checkIsWomenProduct(p);
        if (isMenQuery && !isWomenQuery && isWomen && !fullText.includes('men') && !fullText.includes('couple')) {
          return false;
        }
        if (isWomenQuery && !isMenQuery && !isWomen) {
          return false;
        }

        // Explicit Category constraint enforcement:
        // When user requested an explicit product category (e.g. "men shirts"),
        // eliminate products belonging to other disjoint categories (e.g. "Hoodies", "Jackets", "Bottoms").
        if (explicitCategoryMatch) {
          const expCatL = explicitCategoryMatch.toLowerCase().trim();
          const expCatStem = stemWord(expCatL);

          const isCategoryExact = catL === expCatL;
          const isCategoryStemmed = stemWord(catL) === expCatStem;
          const isTitleExact = titleL.includes(expCatL) || titleL.split(/\s+/).map(stemWord).includes(expCatStem);
          const isTagExact = tagsL.includes(expCatL) || tagsL.map(stemWord).includes(expCatStem);

          if (!isCategoryExact && !isCategoryStemmed && !isTitleExact && !isTagExact) {
            return false;
          }
        }

        return true;
      });

      // 6. Multi-Signal Hybrid Ranking
      candidates.sort((a, b) => {
        const computeScore = (p: CommerceProduct) => {
          let s = 0;
          const tLower = p.title.toLowerCase();
          const dLower = (p.description || '').toLowerCase();
          const catLower = (p.category || '').toLowerCase();
          const tagsLower = (p.tags || []).map(t => t.toLowerCase());

          // Explicit category alignment
          if (explicitCategoryMatch) {
            const expL = explicitCategoryMatch.toLowerCase();
            if (catLower === expL) s += 250;
            else if (stemWord(catLower) === stemWord(expL)) s += 200;
            if (tLower.includes(expL)) s += 150;
          }

          // Exact query match
          if (tLower.includes(cleanQ)) s += 120;

          // Lexical Content token matches
          for (const token of contentTokens) {
            const tokenStem = stemWord(token);
            if (tLower.includes(token)) s += 60;
            else if (stemWord(tLower).includes(tokenStem)) s += 40;

            if (tagsLower.includes(token)) s += 30;
            if (catLower.includes(token)) s += 25;
            if (dLower.includes(token)) s += 15;
          }

          // Semantic use-case matches
          for (const semTerm of matchedSemanticTerms) {
            if (tLower.includes(semTerm)) s += 35;
            if (tagsLower.includes(semTerm)) s += 25;
            if (dLower.includes(semTerm)) s += 15;
          }

          // In-Stock preference
          if (p.in_stock && p.total_inventory > 0) s += 20;

          return s;
        };

        return computeScore(b) - computeScore(a);
      });

      list = candidates;
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
      const colorSynonyms: Record<string, string[]> = {
        red: ['red', 'wine', 'maroon', 'crimson', 'burgundy', 'ruby', 'rust', 'cherry', 'coral'],
        blue: ['blue', 'navy', 'indigo', 'cyan', 'azure', 'teal', 'sky'],
        green: ['green', 'emerald', 'olive', 'mint', 'sage', 'evergreen', 'forest'],
        black: ['black', 'stealth', 'charcoal', 'jet', 'dark'],
        white: ['white', 'off-white', 'off white', 'ivory', 'cream'],
        yellow: ['yellow', 'mustard', 'gold', 'amber', 'lemon']
      };
      const colorFamily = [colorLower, ...(colorSynonyms[colorLower] || [])];

      list = list.filter(p => {
        const full = `${p.title} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase();
        const hasColorInText = colorFamily.some(c => full.includes(c));
        const hasColorInVariant = p.variants.some(v => {
          const vColor = `${v.attributes.color || ''} ${v.title || ''}`.toLowerCase();
          return colorFamily.some(c => vColor.includes(c));
        });
        return hasColorInText || hasColorInVariant;
      });
    }

    if (params.inStockOnly) {
      list = list.filter(p => p.in_stock && p.total_inventory > 0);
    }

    // Deduplicate by title to ensure clean, unique product cards
    const seenTitles = new Set<string>();
    const deduplicated: CommerceProduct[] = [];
    for (const p of list) {
      const norm = p.title.trim().toLowerCase();
      if (!seenTitles.has(norm)) {
        seenTitles.add(norm);
        deduplicated.push(p);
      }
    }

    return deduplicated;
  }

  async compareProducts(workspaceId: string, productIds: string[]): Promise<{
    products: CommerceProduct[];
    cheapest: CommerceProduct | null;
    mostExpensive: CommerceProduct | null;
    comparisonPoints: string[];
  }> {
    const products = db.commerce_products.filter(
      p => p.workspace_id === workspaceId && productIds.includes(p.id)
    );

    if (products.length === 0) {
      return { products: [], cheapest: null, mostExpensive: null, comparisonPoints: [] };
    }

    const sortedByPrice = [...products].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    const mostExpensive = sortedByPrice[sortedByPrice.length - 1];

    const comparisonPoints = products.map(p => 
      `• **${p.title}**: ₹${p.price.toLocaleString('en-IN')}${p.compare_at_price ? ` (MRP ₹${p.compare_at_price.toLocaleString('en-IN')})` : ''} — ${p.category} (${p.in_stock ? 'In Stock' : 'Out of Stock'})`
    );

    return {
      products,
      cheapest,
      mostExpensive,
      comparisonPoints
    };
  }

  async removeFromCart(workspaceId: string, cartId: string, productId: string, variantId?: string): Promise<CommerceCart> {
    const cart = await this.getCart(workspaceId, cartId);
    cart.items = cart.items.filter(
      i => !(i.product_id === productId && (!variantId || i.variant_id === variantId))
    );
    cart.subtotal = cart.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    cart.total = Math.max(0, cart.subtotal - cart.discount_amount);
    cart.updated_at = new Date().toISOString();
    db.scheduleSave();
    return cart;
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
      (o.order_number?.replace('#', '') === cleanNum || o.id === orderNumber) &&
      o.customer_email?.toLowerCase().trim() === cleanEmail
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
