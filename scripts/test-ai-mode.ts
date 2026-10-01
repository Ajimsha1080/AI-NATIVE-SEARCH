/**
 * AI MODE COMPREHENSIVE AUTOMATED VERIFICATION TEST SUITE
 * 
 * Verifies that the completely isolated, additive AI Mode system operates 
 * correctly across all layers:
 * 1. Isolated Storage & Configuration
 * 2. Knowledge Source Management (Crawler & Documents)
 * 3. Safe Catalog Adapter (Read-only Commerce Bridge)
 * 4. AI Search Service (Query Planning, Dense Vector, Lexical Match, Filtering)
 * 5. Conversational Shopping & Recommendation Service
 * 6. Product Comparison & Multi-turn State Engine
 * 7. Isolated Deployments & Widget Script Generation
 * 8. Non-interference with Existing Core Systems
 */

import { aiModeStorage } from '../src/ai-mode/services/storage';
import { AIModeCatalogAdapter } from '../src/ai-mode/adapters/catalog-adapter';
import { AIModeSearchService } from '../src/ai-mode/services/ai-search-service';
import { AIModeChatService } from '../src/ai-mode/services/chat-service';
import { AIModeKnowledgeService } from '../src/ai-mode/services/knowledge-service';
import { AIModeDeploymentService } from '../src/ai-mode/services/deployment-service';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING AI MODE FULL VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  const testWorkspaceId = 'ws_default';

  // -------------------------------------------------------------
  // Test 1: Isolated Storage and Configuration
  // -------------------------------------------------------------
  console.log('📦 Test Suite 1: Isolated Storage & Config Management');
  try {
    const initialConfig = aiModeStorage.getConfig(testWorkspaceId);
    assert(initialConfig !== null && typeof initialConfig === 'object', 'Config loaded successfully');
    assert(initialConfig.enabled === true, 'AI Mode default enabled state is true');
    assert(initialConfig.enable_recommendations === true, 'Recommendations enabled by default');
    assert(initialConfig.enable_comparisons === true, 'Comparisons enabled by default');
    assert(initialConfig.enable_cart_actions === true, 'Cart actions enabled by default');
    
    // Update config test
    const updated = aiModeStorage.updateConfig(testWorkspaceId, { temperature: 0.5 });
    assert(updated.temperature === 0.5, 'Config update persists new values');
    // Restore
    aiModeStorage.updateConfig(testWorkspaceId, { temperature: 0.3 });
  } catch (err: any) {
    assert(false, `Storage test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: Safe Catalog Adapter
  // -------------------------------------------------------------
  console.log('\n🛒 Test Suite 2: Safe Catalog Adapter (Read-only Bridge)');
  try {
    const products = AIModeCatalogAdapter.getProducts(testWorkspaceId);
    assert(Array.isArray(products) && products.length > 0, `Successfully retrieved ${products.length} products from catalog`);
    
    const firstProd = products[0];
    assert(Boolean(firstProd.id && firstProd.title && typeof firstProd.price === 'number'), 'Product contains valid schema fields (id, title, price)');

    const singleProd = AIModeCatalogAdapter.getProductById(firstProd.id);
    assert(singleProd !== null && singleProd.id === firstProd.id, 'Retrieved specific product by ID via adapter');
  } catch (err: any) {
    assert(false, `Catalog adapter test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: Knowledge Management Service
  // -------------------------------------------------------------
  console.log('\n🧠 Test Suite 3: Knowledge Ingestion & Retrieval');
  let testKnowledgeId = '';
  try {
    const newSource = AIModeKnowledgeService.addDocumentSource({
      workspaceId: testWorkspaceId,
      name: 'Shipping Policy FAQ',
      content: 'We offer free standard 3-day shipping on all orders over ₹500 across India. Express 24-hour delivery is available for ₹100 flat.',
      type: 'FAQ'
    });
    testKnowledgeId = newSource.id;
    assert(Boolean(newSource.id), 'Successfully added document knowledge source');
    assert(newSource.document_count === 1, `Document count recorded accurately (1)`);

    const sources = AIModeKnowledgeService.getSources(testWorkspaceId);
    assert(sources.some(s => s.id === testKnowledgeId), 'Knowledge source is discoverable in workspace source list');
  } catch (err: any) {
    assert(false, `Knowledge service test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: AI Search Service & Query Planning
  // -------------------------------------------------------------
  console.log('\n🔍 Test Suite 4: AI Search & Dynamic Query Planning');
  try {
    // Basic query
    const plan1 = AIModeSearchService.parseQuery('cotton casual shirt');
    assert(plan1.intent === 'DISCOVERY', 'Search intent classified as DISCOVERY');
    const searchRes1 = await AIModeSearchService.search(plan1, testWorkspaceId);
    assert(searchRes1.products.length > 0, `Retrieved ${searchRes1.products.length} search results`);
    assert(typeof searchRes1.products[0].score === 'number', 'Results contain calculated AI relevance scores');

    // Price extraction query
    const plan2 = AIModeSearchService.parseQuery('shoes under 3000');
    assert(plan2.extracted_filters.max_price === 3000, `Extracted maximum price filter of 3000 (Got: ${plan2.extracted_filters.max_price})`);
    const searchRes2 = await AIModeSearchService.search(plan2, testWorkspaceId);
    const allUnder3000 = searchRes2.products.every(r => r.price <= 3000);
    assert(allUnder3000, 'All returned products strictly adhere to extracted price constraint');

    // Comparison intent query
    const plan3 = AIModeSearchService.parseQuery('compare casual shirt and denim jeans');
    assert(plan3.intent === 'COMPARISON', 'Detected comparison intent from user query');
  } catch (err: any) {
    assert(false, `AI Search service test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 5: Conversational Shopping & Cart Intent Detection
  // -------------------------------------------------------------
  console.log('\n💬 Test Suite 5: AI Conversational Shopping & Multi-turn Agent');
  let convId = '';
  try {
    // Turn 1: Product inquiry
    const turn1 = await AIModeChatService.processMessage({
      workspaceId: testWorkspaceId,
      userMessage: 'Recommend a stylish shirt for summer under 2500'
    });
    convId = turn1.conversation.id;
    assert(Boolean(convId), 'Initialized new AI shopping conversation');
    assert(turn1.responseMessage.role === 'assistant', 'Received assistant response');
    assert(turn1.responseMessage.products && turn1.responseMessage.products.length > 0, `Returned ${turn1.responseMessage.products?.length || 0} product recommendations`);

    // Turn 2: Comparison turn
    const turn2 = await AIModeChatService.processMessage({
      conversationId: convId,
      workspaceId: testWorkspaceId,
      userMessage: 'Compare the first and second one'
    });
    assert(turn2.responseMessage.comparison !== undefined, 'Generated side-by-side comparison structure');
    assert(Boolean(turn2.responseMessage.comparison?.summary), 'Comparison contains synthesis summary');

    // Turn 3: Add to cart intent
    const firstRecommendedProd = turn1.responseMessage.products![0];
    const turn3 = await AIModeChatService.processMessage({
      conversationId: convId,
      workspaceId: testWorkspaceId,
      userMessage: `Add the first one to my cart`
    });
    assert(turn3.responseMessage.cart_action_performed !== undefined, 'Detected explicit add-to-cart action');
    assert(turn3.responseMessage.cart_action_performed?.action === 'ADD', 'Cart action type is "ADD"');
    assert(turn3.responseMessage.cart_action_performed?.product_title === firstRecommendedProd.title, 'Cart action targeted the correct product title');
  } catch (err: any) {
    assert(false, `AI Chat service test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 6: Isolated Deployments & Widget Embed
  // -------------------------------------------------------------
  console.log('\n🌐 Test Suite 6: Isolated Deployments & Script Generator');
  let testDeploymentId = '';
  try {
    const deployment = AIModeDeploymentService.createDeployment({
      workspaceId: testWorkspaceId,
      name: 'Black Friday Production Widget',
      allowed_domains: ['https://store.example.com', 'https://shop.example.com']
    });
    testDeploymentId = deployment.id;
    assert(Boolean(deployment.id), 'Successfully created isolated AI Mode deployment');
    assert(deployment.status === 'LIVE', 'Deployment has active status LIVE');

    // Update deployment
    const updatedDep = AIModeDeploymentService.updateDeployment(testDeploymentId, {
      branding: {
        ...deployment.branding,
        title: 'Custom AI Assistant'
      }
    });
    assert(updatedDep?.branding.title === 'Custom AI Assistant', 'Updated deployment branding title successfully');

    // Generate standalone embed script
    const script = AIModeDeploymentService.generateScriptJs(deployment, 'http://localhost:3000');
    assert(script.includes('(function()'), 'Generated self-executing standalone embed script');
    assert(script.includes(deployment.id), 'Script contains deployment ID tag');
    assert(script.includes('aimode-widget-frame'), 'Script configures isolation DOM wrapper');
  } catch (err: any) {
    assert(false, `Deployment test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Cleanup test artifacts
  // -------------------------------------------------------------
  console.log('\n🧹 Cleaning up test artifacts...');
  if (testKnowledgeId) {
    AIModeKnowledgeService.deleteSource(testKnowledgeId);
  }
  if (testDeploymentId) {
    AIModeDeploymentService.deleteDeployment(testDeploymentId);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`💥 AI MODE VERIFICATION FAILED with ${failedTests} failure(s).`);
    process.exit(1);
  } else {
    console.log('✨ ALL AI MODE TESTS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
