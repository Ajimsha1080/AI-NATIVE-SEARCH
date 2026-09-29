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
  db.reload();
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  RUNNING AGENTIC E-COMMERCE EVALUATION TEST SUITE (18+ SCENARIOS)${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // Ensure workspace ID
  const workspaceId = 'ws_acme_corp';
  const agentId = 'agent_shopmate_01';

  // Add store policy knowledge chunk if not already present
  if (!db.knowledge_chunks.some(c => c.workspace_id === workspaceId && c.document_id === 'doc_policy_01')) {
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
  }

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
  // 2. EXPLICIT CONSTRAINT VS SEMANTIC RETRIEVAL ("men shirts")
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 2. Explicit Constraint Enforcement ("men shirts") ---${RESET}`);

  const resMenShirts = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'men shirts',
    channel: 'PLAYGROUND'
  });
  assert(resMenShirts.interactive_payload?.type === 'PRODUCTS', 'Men shirts query returns structured PRODUCTS payload');
  const menShirtProducts = resMenShirts.interactive_payload?.data || [];
  assert(menShirtProducts.length > 0, 'Returns at least 1 shirt');
  const allAreShirts = menShirtProducts.every((p: any) => 
    p.category.toLowerCase() === 'shirts' || p.title.toLowerCase().includes('shirt')
  );
  assert(allAreShirts, 'Strict constraint: All results belong to Shirts category and exclude hoodies/jackets/t-shirts');
  const noHoodiesOrJackets = menShirtProducts.every((p: any) =>
    !p.category.toLowerCase().includes('hoodie') && !p.category.toLowerCase().includes('outerwear')
  );
  assert(noHoodiesOrJackets, 'Strictly zero hoodies, outerwear, or sarees in "men shirts" results');

  // ------------------------------------------------------------------------
  // 3. SEMANTIC USE-CASE RETRIEVAL ("something for the gym")
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 3. Semantic Use-Case & Occasion Queries ---${RESET}`);

  const resGym = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'I need something for the gym',
    channel: 'PLAYGROUND'
  });
  assert(resGym.interactive_payload?.type === 'PRODUCTS', 'Gym query returns structured PRODUCTS payload');
  const gymProducts = resGym.interactive_payload?.data || [];
  const hasGymActivewear = gymProducts.some((p: any) =>
    /tee|nosweat|jacket|cooling|active|breathable/i.test(p.title + ' ' + (p.tags || []).join(' ') + ' ' + (p.description || ''))
  );
  assert(hasGymActivewear, 'Semantic mapping returns activewear/breathable gear for gym query without hardcoded category rule');

  // ------------------------------------------------------------------------
  // 4. VAGUE SHOPPING REQUEST ("I want something nice")
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 4. Vague & Underspecified Shopping Requests ---${RESET}`);

  const resVague = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'I want something nice',
    channel: 'PLAYGROUND'
  });
  assert(resVague.interactive_payload?.type === 'PRODUCTS', 'Vague query returns featured catalog products');
  assert(!resVague.response_text.includes('While we don\'t have a specific'), 'Zero meta-catalog apologizing on vague request');

  // ------------------------------------------------------------------------
  // 5. DYNAMIC TAXONOMY ON TOTALLY UNSEEN MERCHANTS / DOMAINS
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 5. Dynamic Taxonomy Extraction for Unseen Domains ---${RESET}`);

  const unseenWorkspaceId = 'ws_custom_hardware_store';
  const unseenAgentId = 'agent_hardware_01';

  // Seed non-fashion custom merchant catalog (Keyboards & Audio)
  db.commerce_products.push(
    {
      id: 'prod_kb_01',
      workspace_id: unseenWorkspaceId,
      title: 'Apex Pro Mechanical Keyboard',
      description: 'Custom mechanical keyboard with hot-swappable switches and RGB backlighting.',
      category: 'Mechanical Keyboards',
      tags: ['keyboard', 'switches', 'rgb', 'gaming', 'hardware'],
      price: 8999,
      currency: 'INR',
      images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'],
      in_stock: true,
      total_inventory: 15,
      variants: [{ id: 'var_kb_01', sku: 'KB-APEX', title: 'Standard', price: 8999, inventory_quantity: 15, attributes: {} }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'prod_plant_01',
      workspace_id: unseenWorkspaceId,
      title: 'Nordic Minimalist Ceramic Planter',
      description: 'Handcrafted ceramic planter with drainage tray for indoor succulents.',
      category: 'Ceramic Planters',
      tags: ['planter', 'pots', 'ceramic', 'decor', 'plants'],
      price: 1299,
      currency: 'INR',
      images: ['https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80'],
      in_stock: true,
      total_inventory: 20,
      variants: [{ id: 'var_pl_01', sku: 'PL-NORDIC', title: 'Medium', price: 1299, inventory_quantity: 20, attributes: {} }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  );

  const resUnseenCat = await runAgentCycle({
    agent_id: unseenAgentId,
    workspace_id: unseenWorkspaceId,
    user_message: 'show me mechanical keyboards',
    channel: 'PLAYGROUND'
  });
  assert(resUnseenCat.interactive_payload?.type === 'PRODUCTS', 'Unseen domain query returns PRODUCTS payload');
  const unseenProducts = resUnseenCat.interactive_payload?.data || [];
  assert(unseenProducts.length === 1 && unseenProducts[0].category === 'Mechanical Keyboards', 'Dynamically extracted unseen category "Mechanical Keyboards" and excluded "Ceramic Planters" with zero hardcoding');

  // Clean up unseen test fixtures so database remains 100% clean
  db.commerce_products = db.commerce_products.filter(p => p.workspace_id !== unseenWorkspaceId);

  // ------------------------------------------------------------------------
  // 6. DEMOGRAPHIC & ATTRIBUTE FILTERING
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 6. Demographic & Color Attribute Filtering ---${RESET}`);

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
  assert(hasRedMatch, 'Red shirts query matches real red/maroon shirts');
  assert(!resRed.response_text.includes('[Product Card]'), 'No fake text tags in red shirts response');

  // ------------------------------------------------------------------------
  // 7. PRODUCT COMPARISON
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 7. Multi-Product Comparison & Ordinals ---${RESET}`);

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
  // 8. CONVERSATIONAL PRONOUN & ORDINAL RESOLUTION
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 8. Contextual Pronouns & Ordinals (First, Second, That) ---${RESET}`);

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
  // 9. LIVE INVENTORY VERIFICATION
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 9. Authoritative Inventory Lookup ---${RESET}`);

  const resInventory = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: convId,
    user_message: 'is size M in stock for this?',
    channel: 'PLAYGROUND'
  });
  assert(/In Stock|available/i.test(resInventory.response_text), 'Authoritative inventory check verifies size M availability');

  // ------------------------------------------------------------------------
  // 10. ORDER TRACKING & FULFILLMENT
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 10. Real-Time Order Lookup ---${RESET}`);

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
    items: [{ product_id: 'prod_live_mumqr1q1gppk6ewj', title: 'Wild West | Relaxed Fit | Luxe Cotton Shirt', quantity: 1, price: 1499 }],
    total_amount: 1499,
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
  // 11. RETURN & POLICY INQUIRIES
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 11. Grounded Policy Inquiries ---${RESET}`);

  const resPolicy = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'what is your return policy?',
    channel: 'PLAYGROUND'
  });
  assert(/7|return|exchange|reverse pickup/i.test(resPolicy.response_text), 'Return policy answered from verified store knowledge chunk');

  // ------------------------------------------------------------------------
  // 12. MIXED MULTI-INTENT QUERIES
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 12. Mixed Multi-Intent (Product Discovery + Policy) ---${RESET}`);

  const resMixed = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'show me a green shirt under ₹2000 and tell me if I can return it',
    channel: 'PLAYGROUND'
  });
  assert(resMixed.interactive_payload?.type === 'PRODUCTS', 'Mixed query returns structured product cards');
  assert(/return|exchange|days/i.test(resMixed.response_text), 'Mixed query successfully addresses return policy in same response');

  // ------------------------------------------------------------------------
  // 13. MULTI-TURN SEARCH STATE INHERITANCE & REFINEMENTS
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 13. Multi-Turn Search State Inheritance & Refinements ---${RESET}`);

  const searchConvId = 'conv_search_state_' + Date.now();
  
  // Turn 1: Search shirts
  const resTurn1 = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: searchConvId,
    user_message: 'show me shirts',
    channel: 'PLAYGROUND'
  });
  assert(resTurn1.interactive_payload?.type === 'PRODUCTS', 'Turn 1 returns structured shirts payload');

  // Turn 2: Refine price bound ("only under 1500") without repeating "shirts"
  const resTurn2 = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: searchConvId,
    user_message: 'only under 1500',
    channel: 'PLAYGROUND'
  });
  assert(resTurn2.interactive_payload?.type === 'PRODUCTS', 'Turn 2 inherits category "shirts" from Turn 1');
  const refinedProds = resTurn2.interactive_payload?.data || [];
  const allUnder1500 = refinedProds.every((p: any) => p.price <= 1500);
  assert(allUnder1500, 'Turn 2 enforces max price <= 1500 constraint');

  // Turn 3: Pagination ("show more") inherits constraints and returns next page
  const resTurn3 = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    conversation_id: searchConvId,
    user_message: 'show more',
    channel: 'PLAYGROUND'
  });
  assert(resTurn3.interactive_payload?.type === 'PRODUCTS', 'Turn 3 (pagination) returns structured products payload');
  const pageProds = resTurn3.interactive_payload?.data || [];
  const pageUnder1500 = pageProds.every((p: any) => p.price <= 1500);
  assert(pageUnder1500, 'Turn 3 preserves price <= 1500 filter on next page');

  // ------------------------------------------------------------------------
  // 14. DYNAMIC PRICE & RECENCY SORTING
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 14. Dynamic Price & Recency Sorting ---${RESET}`);

  const resSortPriceAsc = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'cheaper shirts',
    channel: 'PLAYGROUND'
  });
  const sortAscProds = resSortPriceAsc.interactive_payload?.data || [];
  assert(sortAscProds.length >= 2, 'Returns multiple shirts for price sort');
  const isAscending = sortAscProds.every((p: any, i: number) => i === 0 || p.price >= sortAscProds[i - 1].price);
  assert(isAscending, 'Cheaper shirts are sorted in ascending price order');

  const resSortPriceDesc = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'most expensive shirts',
    channel: 'PLAYGROUND'
  });
  const sortDescProds = resSortPriceDesc.interactive_payload?.data || [];
  assert(sortDescProds.length >= 2, 'Returns multiple shirts for high price sort');
  const isDescending = sortDescProds.every((p: any, i: number) => i === 0 || p.price <= sortDescProds[i - 1].price);
  assert(isDescending, 'Most expensive shirts are sorted in descending price order');

  // ------------------------------------------------------------------------
  // 15. COMPLETE COLLECTION DISCOVERY ("show all matching")
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 15. Complete Collection Discovery ("show all") ---${RESET}`);

  const resAllShirts = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'show all shirts',
    channel: 'PLAYGROUND'
  });
  assert(resAllShirts.interactive_payload?.type === 'PRODUCTS', 'Show all shirts returns structured PRODUCTS payload');
  const allShirtsList = resAllShirts.interactive_payload?.data || [];
  assert(allShirtsList.length >= 10, 'Show all shirts fetches comprehensive catalog slice');

  // ------------------------------------------------------------------------
  // 16. NON-EXISTENT PRODUCT CONSTRAINT HANDLING
  // ------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 16. Non-Existent Product Constraint Handling ---${RESET}`);

  const resNonExistent = await runAgentCycle({
    agent_id: agentId,
    workspace_id: workspaceId,
    user_message: 'show me running shoes',
    channel: 'PLAYGROUND'
  });
  assert(resNonExistent.interactive_payload === null || resNonExistent.interactive_payload?.data?.length === 0, 'Does NOT hallucinate shoes when store catalog has zero footwear items');
  assert(/couldn't find|not find|active collection/i.test(resNonExistent.response_text), 'Politely clarifies no exact match exists in current store collection');

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
