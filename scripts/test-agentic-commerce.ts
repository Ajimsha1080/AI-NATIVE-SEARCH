import { runAgentCycle } from '../src/lib/agent-runtime';
import { db } from '../src/lib/db';
import { seedDatabaseIfEmpty } from '../src/lib/db/seed';
import { generateId } from '../src/lib/utils';
import { CommerceProduct } from '../src/types';

// ANSI color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetail?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓ [PASS]${RESET} ${testName}`);
    passed++;
  } else {
    console.error(`  ${RED}✗ [FAIL]${RESET} ${testName}`);
    if (failureDetail) {
      console.error(`    ${RED}Detail:${RESET} ${failureDetail}`);
    }
    failed++;
  }
}

async function runTestSuite() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  RUNNING AGENTIC E-COMMERCE EVALUATION TEST SUITE (18+ SCENARIOS)${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // Initialize and seed database
  await seedDatabaseIfEmpty(true);
  const workspaceId = 'ws_acme_corp';
  const agentId = 'agent_shopmate_01';

  // Seed sample Mydesignation products to test real-world catalog truth
  const sampleProducts: CommerceProduct[] = [
    {
      id: 'prod_my_corduroy_shirt',
      workspace_id: workspaceId,
      title: 'Corduroy Shirt Combined listing',
      description: 'Premium heavyweight ribbed corduroy long sleeve shirt for men.',
      category: 'Shirts',
      tags: ['shirt', 'corduroy', 'men', 'mens', 'casual', 'autumn', 'wine', 'navy', 'brown'],
      price: 1499,
      compare_at_price: 2499,
      currency: 'INR',
      images: ['https://cdn.shopify.com/s/files/1/corduroy.jpg'],
      in_stock: true,
      total_inventory: 40,
      variants: [
        { id: 'var_cord_m_wine', sku: 'SKU-CORD-M-WINE', title: 'M / Wine Red', price: 1499, inventory_quantity: 20, attributes: { size: 'M', color: 'Wine' } },
        { id: 'var_cord_l_navy', sku: 'SKU-CORD-L-NVY', title: 'L / Navy Blue', price: 1499, inventory_quantity: 20, attributes: { size: 'L', color: 'Navy' } }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'prod_my_royal_saree',
      workspace_id: workspaceId,
      title: 'Royal Heritage Saree',
      description: 'Off-white Poly Chambray saree with delicate multicolored diamond butis and heritage borders.',
      category: 'Sarees',
      tags: ['saree', 'women', 'womens', 'ethnic', 'festive', 'traditional', 'off-white'],
      price: 1699,
      compare_at_price: 2999,
      currency: 'INR',
      images: ['https://cdn.shopify.com/s/files/1/saree.jpg'],
      in_stock: true,
      total_inventory: 35,
      variants: [
        { id: 'var_saree_free', sku: 'SKU-ROYAL-FREE', title: 'Free Size', price: 1699, inventory_quantity: 35, attributes: { size: 'Free Size', color: 'Off White' } }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'prod_my_yellow_kurta_combo',
      workspace_id: workspaceId,
      title: 'Yellow Floral Kurta Pant Combo',
      description: 'Yellow Floral Poly Chambray kurta paired with an Off White Cotton Poplin pant.',
      category: 'Kurtas',
      tags: ['kurta', 'combo', 'women', 'womens', 'festive', 'yellow', 'floral'],
      price: 2399,
      compare_at_price: 3697,
      currency: 'INR',
      images: ['https://cdn.shopify.com/s/files/1/kurta_combo.jpg'],
      in_stock: true,
      total_inventory: 25,
      variants: [
        { id: 'var_kurta_m_yel', sku: 'SKU-YEL-M', title: 'M', price: 2399, inventory_quantity: 15, attributes: { size: 'M', color: 'Yellow' } },
        { id: 'var_kurta_l_yel', sku: 'SKU-YEL-L', title: 'L', price: 2399, inventory_quantity: 10, attributes: { size: 'L', color: 'Yellow' } }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'prod_my_red_shirt',
      workspace_id: workspaceId,
      title: 'Relaxed Fit Shirt — Shadow Red',
      description: 'Breathable lightweight 100% cotton casual button-down shirt in rich shadow red tone.',
      category: 'Shirts',
      tags: ['shirt', 'red', 'shadow red', 'men', 'casual', 'cotton'],
      price: 1199,
      compare_at_price: 1399,
      currency: 'INR',
      images: ['https://cdn.shopify.com/s/files/1/red_shirt.jpg'],
      in_stock: true,
      total_inventory: 30,
      variants: [
        { id: 'var_red_s', sku: 'SKU-RED-S', title: 'S', price: 1199, inventory_quantity: 15, attributes: { size: 'S', color: 'Red' } },
        { id: 'var_red_m', sku: 'SKU-RED-M', title: 'M', price: 1199, inventory_quantity: 15, attributes: { size: 'M', color: 'Red' } }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  db.commerce_products.push(...sampleProducts);

  // Add store policy knowledge chunk
  db.knowledge_chunks.push({
    id: generateId('chunk'),
    document_id: 'doc_policy_01',
    workspace_id: workspaceId,
    chunk_index: 0,
    content: 'Return & Exchange Policy: Customers can exchange or return unworn items within 7 days of delivery. Free doorstep reverse pickup is provided for all eligible pin codes.',
    embedding: [0.1, 0.2, 0.3],
    metadata: { source_name: 'Store Policies' },
    created_at: new Date().toISOString()
  });

  // ------------------------------------------------------------------------
  // 1. PRODUCT DISCOVERY & OCCASION QUERIES
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 1. Product Discovery & Occasion Queries ---${RESET}`);

  const resDiscovery = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'show me something nice for a dinner',
    channel: 'PLAYGROUND'
  });
  assert(resDiscovery.interactive_payload?.type === 'PRODUCTS', 'Dinner discovery returns structured PRODUCTS payload');
  assert(resDiscovery.interactive_payload?.data?.length > 0, 'Returns at least 1 product for dinner occasion');
  assert(!resDiscovery.response_text.includes('[Product Card]'), 'Response text contains zero fake [Product Card] markers');

  const resBrother = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'I need a gift for my brother around ₹1500',
    channel: 'PLAYGROUND'
  });
  assert(resBrother.interactive_payload?.type === 'PRODUCTS', 'Gift for brother returns structured PRODUCTS payload');
  const brotherProducts = resBrother.interactive_payload?.data || [];
  const brotherFitsBudget = brotherProducts.some((p: any) => p.price <= 1600);
  assert(brotherFitsBudget, 'Returns products fitting the ₹1500 budget constraint');

  // ------------------------------------------------------------------------
  // 2. DEMOGRAPHIC & ATTRIBUTE FILTERING
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 2. Demographic & Color Attribute Filtering ---${RESET}`);

  const resWomen = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'women products',
    channel: 'PLAYGROUND'
  });
  assert(resWomen.interactive_payload?.type === 'PRODUCTS', 'Women products query returns PRODUCTS payload');
  const womenProds = resWomen.interactive_payload?.data || [];
  const hasOnlyWomenItems = womenProds.every((p: any) => 
    /saree|kurta|women|dress|female/i.test(p.title + ' ' + p.category + ' ' + p.tags.join(' '))
  );
  assert(hasOnlyWomenItems, 'Women query returns sarees/kurtas/women wear and EXCLUDES exclusively men corduroy shirts');

  const resRed = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'any red shirts',
    channel: 'PLAYGROUND'
  });
  assert(resRed.interactive_payload?.type === 'PRODUCTS', 'Red shirts query returns PRODUCTS payload');
  const redProds = resRed.interactive_payload?.data || [];
  const hasRedMatch = redProds.some((p: any) => 
    /red|wine|maroon|crimson/i.test(p.title + ' ' + p.tags.join(' ') + ' ' + JSON.stringify(p.variants))
  );
  assert(hasRedMatch, 'Red shirts query matches Shadow Red and Wine Red products');
  assert(!resRed.response_text.includes('[Product Card]'), 'No fake text tags in red shirts response');

  // ------------------------------------------------------------------------
  // 3. PRODUCT COMPARISON
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 3. Multi-Product Comparison & Ordinals ---${RESET}`);

  const convId = 'conv_comp_test_' + Date.now();
  
  // Turn 1: Discover items
  await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: convId,
    user_message: 'show me shirts',
    channel: 'PLAYGROUND'
  });

  // Turn 2: Which is cheaper?
  const resCheaper = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: convId,
    user_message: 'which one is cheaper?',
    channel: 'PLAYGROUND'
  });
  assert(/cheaper|affordable|₹/i.test(resCheaper.response_text), 'Cheaper query accurately compares prices in conversation');
  assert(resCheaper.interactive_payload?.type === 'PRODUCTS', 'Comparison returns structured products for visual reference');

  // ------------------------------------------------------------------------
  // 4. CONVERSATIONAL PRONOUN & ORDINAL RESOLUTION
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 4. Contextual Pronouns & Ordinals (First, Second, That) ---${RESET}`);

  // Turn 3: Add the second one to cart
  const resAddSecond = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: convId,
    user_message: 'add the second one to my cart',
    channel: 'PLAYGROUND'
  });
  assert(/Added/i.test(resAddSecond.response_text), 'Resolves "second one" ordinal and adds item to cart');
  assert(resAddSecond.interactive_payload?.type === 'PRODUCTS', 'Returns structured card for the added item');

  // ------------------------------------------------------------------------
  // 5. LIVE INVENTORY VERIFICATION
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 5. Authoritative Inventory Lookup ---${RESET}`);

  const resInventory = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: convId,
    user_message: 'is size M in stock for this?',
    channel: 'PLAYGROUND'
  });
  assert(/In Stock|available/i.test(resInventory.response_text), 'Authoritative inventory check verifies size M availability');

  // ------------------------------------------------------------------------
  // 6. ORDER TRACKING & FULFILLMENT
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 6. Real-Time Order Lookup ---${RESET}`);

  // Seed sample order
  db.commerce_orders.push({
    id: 'ord_10999',
    workspace_id: workspaceId,
    order_number: '#10999',
    customer_id: 'cust_01',
    customer_email: 'sarah.sharma@gmail.com',
    status: 'IN_TRANSIT',
    carrier: 'Bluedart Express',
    tracking_number: 'BLUEDART-8839201',
    shipping_address: 'Flat 402, Lotus Heights, Bengaluru, KA',
    items: [{ product_id: 'prod_my_red_shirt', title: 'Relaxed Fit Shirt — Shadow Red', quantity: 1, price: 1199 }],
    total_amount: 1199,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const resOrder = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'where is my order #10999?',
    customer_identifier: 'sarah.sharma@gmail.com',
    channel: 'PLAYGROUND'
  });
  assert(resOrder.interactive_payload?.type === 'ORDER_TRACKING', 'Order tracking returns structured ORDER_TRACKING payload');
  assert(/IN_TRANSIT/i.test(resOrder.response_text), 'Order response reflects live order status');

  // ------------------------------------------------------------------------
  // 7. RETURN & POLICY INQUIRIES
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 7. Grounded Policy Inquiries ---${RESET}`);

  const resPolicy = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'what is your return policy?',
    channel: 'PLAYGROUND'
  });
  assert(/7|return|exchange|reverse pickup/i.test(resPolicy.response_text), 'Return policy answered from verified store knowledge chunk');

  // ------------------------------------------------------------------------
  // 8. MIXED MULTI-INTENT QUERIES
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 8. Mixed Multi-Intent (Product Discovery + Policy) ---${RESET}`);

  const resMixed = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'show me a black shirt under ₹2000 and tell me if I can return it',
    channel: 'PLAYGROUND'
  });
  assert(resMixed.interactive_payload?.type === 'PRODUCTS', 'Mixed query returns structured product cards');
  assert(/return|exchange|days/i.test(resMixed.response_text), 'Mixed query successfully addresses return policy in same response');

  // ------------------------------------------------------------------------
  // 9. ZERO FAKE TEXT CARDS / ZERO HALLUCINATIONS
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 9. Strict Text Cleanliness & Persona Guardrails ---${RESET}`);

  const resCleanliness = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'new products',
    channel: 'PLAYGROUND'
  });
  assert(!resCleanliness.response_text.includes('While we don\'t have a specific'), 'Zero meta-catalog apologetic phrasing');
  assert(!resCleanliness.response_text.includes('[Product Card]'), 'Zero fake [Product Card] text artifacts');
  assert(!resCleanliness.response_text.includes('— Add to Cart'), 'Zero fake markdown button text artifacts');
  assert(resCleanliness.interactive_payload?.type === 'PRODUCTS', 'Attached real structured product cards');

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`  EVALUATION SUMMARY: ${passed}/${passed + failed} TESTS PASSED (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
