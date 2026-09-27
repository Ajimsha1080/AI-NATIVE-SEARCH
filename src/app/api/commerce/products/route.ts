import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { CommerceProduct } from '@/types';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  let products = db.commerce_products.filter(p => p.workspace_id === session.workspaceId);

  if (products.length === 0) {
    const defaultCatalog: CommerceProduct[] = [
      {
        id: generateId('prod'),
        workspace_id: session.workspaceId,
        title: 'UPF 50+ Sunscreen Performance Jacket',
        description: 'Ultra-lightweight, 4-way stretch breathable sunscreen jacket with UPF 50+ UV ray blocking protection and mesh underarm venting.',
        category: 'Techwear Jackets',
        tags: ['sunscreen', 'upf50', 'breathable', 'lightweight', 'jacket', 'techwear'],
        price: 2499.00,
        compare_at_price: 2999.00,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80'],
        in_stock: true,
        total_inventory: 48,
        variants: [
          { id: generateId('var'), sku: 'BT-JCK-01-BLK-M', title: 'Medium / Obsidian Black', inventory_quantity: 16, price: 2499.00, attributes: { size: 'M', color: 'Obsidian Black' } },
          { id: generateId('var'), sku: 'BT-JCK-01-BLK-L', title: 'Large / Obsidian Black', inventory_quantity: 20, price: 2499.00, attributes: { size: 'L', color: 'Obsidian Black' } },
          { id: generateId('var'), sku: 'BT-JCK-01-BLK-XL', title: 'XL / Obsidian Black', inventory_quantity: 12, price: 2499.00, attributes: { size: 'XL', color: 'Obsidian Black' } }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateId('prod'),
        workspace_id: session.workspaceId,
        title: 'No-Sweat Anti-Odour Tech Tee',
        description: 'Moisture-wicking silver-infused tech fabric designed to stay fresh and dry during high-intensity training.',
        category: 'Performance Tees',
        tags: ['nosweat', 'antiodour', 'breathable', 'gym', 'tshirt'],
        price: 999.00,
        compare_at_price: 1399.00,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'],
        in_stock: true,
        total_inventory: 65,
        variants: [
          { id: generateId('var'), sku: 'BT-TEE-02-NVY-M', title: 'Medium / Navy Blue', inventory_quantity: 25, price: 999.00, attributes: { size: 'M', color: 'Navy Blue' } },
          { id: generateId('var'), sku: 'BT-TEE-02-NVY-L', title: 'Large / Navy Blue', inventory_quantity: 40, price: 999.00, attributes: { size: 'L', color: 'Navy Blue' } }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: generateId('prod'),
        workspace_id: session.workspaceId,
        title: 'All-Day 4-Way Stretch Commuter Joggers',
        description: 'Tailored athletic fit with water-resistant DWR coating and secure zip pockets for daily wear and mobility.',
        category: 'Bottoms',
        tags: ['joggers', 'stretch', 'waterresistant', 'commuter'],
        price: 1899.00,
        compare_at_price: 2499.00,
        currency: 'INR',
        images: ['https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=80'],
        in_stock: true,
        total_inventory: 40,
        variants: [
          { id: generateId('var'), sku: 'BT-JOG-03-GRY-32', title: 'Size 32 / Slate Grey', inventory_quantity: 20, price: 1899.00, attributes: { size: '32', color: 'Slate Grey' } },
          { id: generateId('var'), sku: 'BT-JOG-03-GRY-34', title: 'Size 34 / Slate Grey', inventory_quantity: 20, price: 1899.00, attributes: { size: '34', color: 'Slate Grey' } }
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    db.commerce_products.push(...defaultCatalog);
    db.scheduleSave();
    products = db.commerce_products.filter(p => p.workspace_id === session.workspaceId);
  }

  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const inventoryQty = parseInt(body.inventory || body.total_inventory || '50', 10);
    const priceVal = parseFloat(body.price || '999');

    const newProduct: CommerceProduct = {
      id: generateId('prod_bt'),
      workspace_id: session.workspaceId,
      title: body.title || 'New Performance Apparel',
      description: body.description || 'High-performance active techwear engineered for breathability and endurance.',
      category: body.category || 'Performance Apparel',
      tags: Array.isArray(body.tags) ? body.tags : (body.tags ? body.tags.split(',').map((t: string) => t.trim()) : ['techwear', 'bluetyga']),
      price: priceVal,
      compare_at_price: body.compare_at_price ? parseFloat(body.compare_at_price) : priceVal * 1.25,
      currency: 'INR',
      images: Array.isArray(body.images) && body.images.length > 0 
        ? body.images 
        : [body.imageUrl || 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80'],
      in_stock: inventoryQty > 0,
      total_inventory: inventoryQty,
      variants: Array.isArray(body.variants) && body.variants.length > 0 ? body.variants : [
        {
          id: generateId('var'),
          sku: `BT-${(body.title || 'ITEM').replace(/\s+/g, '-').toUpperCase().slice(0, 8)}-M`,
          title: 'Standard / Free Size',
          inventory_quantity: inventoryQty,
          price: priceVal,
          attributes: { size: 'M' }
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.commerce_products.unshift(newProduct);
    db.saveImmediate();
    return NextResponse.json({ success: true, product: newProduct });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Product creation failed' } }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, inventory, total_inventory, price, in_stock, title, category, description } = body;
    if (!id) return NextResponse.json({ error: { message: 'Product ID is required' } }, { status: 400 });

    const prod = db.commerce_products.find(p => p.id === id && p.workspace_id === session.workspaceId);
    if (!prod) return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 });

    if (total_inventory !== undefined || inventory !== undefined) {
      const newInv = Math.max(0, parseInt((total_inventory ?? inventory) || '0', 10));
      prod.total_inventory = newInv;
      prod.in_stock = newInv > 0;
      if (prod.variants && prod.variants.length > 0) {
        prod.variants[0].inventory_quantity = newInv;
      }
    }
    if (price !== undefined) prod.price = parseFloat(price);
    if (in_stock !== undefined) prod.in_stock = Boolean(in_stock);
    if (title !== undefined) prod.title = title;
    if (category !== undefined) prod.category = category;
    if (description !== undefined) prod.description = description;
    prod.updated_at = new Date().toISOString();

    db.saveImmediate();
    return NextResponse.json({ success: true, product: prod });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Update failed' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return PUT(req);
}

export async function DELETE(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const idx = db.commerce_products.findIndex(p => p.id === id && p.workspace_id === session.workspaceId);
  if (idx >= 0) {
    db.commerce_products.splice(idx, 1);
    db.saveImmediate();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: { message: 'Product not found' } }, { status: 404 });
}
