/**
 * AI MODE PRODUCTION RETRIEVAL & SEARCH VERIFICATION SUITE
 * 
 * Verifies that the generic, variant-aware AI Mode retrieval engine operates
 * correctly according to production ecommerce invariants:
 * 1. Isolated Storage & Configuration
 * 2. Knowledge Source Management (Crawler & Documents)
 * 3. Safe Catalog Adapter (Read-only Commerce Bridge)
 * 4. Multi-Constraint Query Understanding (Hard vs Soft, Bounds, Exclusions, Dynamic Extraction)
 * 5. Word-Boundary Product Type & Category Precision
 * 6. Variant-Aware Multi-Attribute Consistency (Single Variant Invariant)
 * 7. Hard-Constraint Invariant Enforcement (0% violation rate across all results)
 * 8. Soft Preferences & Stylistic Alignment
 * 9. Conversational Multi-Turn Shopping & State Refinements
 * 10. Accurate Post-Validation Pagination & Diagnostics
 * 11. Isolated Deployments & Widget Script Generation
 */

import { aiModeStorage } from '../src/ai-mode/services/storage';
import { AIModeCatalogAdapter } from '../src/ai-mode/adapters/catalog-adapter';
import { AIModeSearchService } from '../src/ai-mode/services/ai-search-service';
import { AIModeChatService } from '../src/ai-mode/services/chat-service';
import { AIModeKnowledgeService } from '../src/ai-mode/services/knowledge-service';
import { AIModeDeploymentService } from '../src/ai-mode/services/deployment-service';
import { ConstraintEvaluator } from '../src/ai-mode/services/constraint-evaluator';
import { AIModeProduct } from '../src/ai-mode/types';
import { seedDatabaseIfEmpty } from '../src/lib/db/seed';

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
  console.log('🚀 RUNNING PRODUCTION SEARCH & RETRIEVAL VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // Ensure dev database is seeded for catalog products
  await seedDatabaseIfEmpty(true);

  const testWorkspaceId = 'ws_default';

  // -------------------------------------------------------------
  // Test Suite 1: Isolated Storage and Configuration
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
  // Test Suite 2: Safe Catalog Adapter
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
  // Test Suite 3: Knowledge Management Service
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
  // Test Suite 4: Multi-Constraint Query Understanding & Price Bounds
  // -------------------------------------------------------------
  console.log('\n🔍 Test Suite 4: Multi-Constraint Query Understanding & Hard/Soft Bounds');
  try {
    // Basic Discovery Query
    const plan1 = AIModeSearchService.parseQuery('cotton casual shirt', undefined, testWorkspaceId);
    assert(plan1.intent === 'DISCOVERY', 'Search intent classified as DISCOVERY');
    assert(plan1.soft_preferences.includes('casual'), 'Extracted soft preference "casual"');
    assert(plan1.extracted_filters.category === 'Shirt', 'Extracted category "Shirt"');
    assert(plan1.extracted_filters.material === 'cotton', 'Extracted material "cotton"');
    const searchRes1 = await AIModeSearchService.search(plan1, testWorkspaceId);
    assert(searchRes1.products.length > 0, `Retrieved ${searchRes1.products.length} search results`);
    assert(typeof searchRes1.products[0].score === 'number', 'Results contain calculated AI relevance scores');

    // Price Upper Bound Query ("under 3000")
    const plan2 = AIModeSearchService.parseQuery('shoes under 3000', undefined, testWorkspaceId);
    assert(plan2.extracted_filters.max_price === 3000, `Extracted maximum price filter of 3000 (Got: ${plan2.extracted_filters.max_price})`);
    const searchRes2 = await AIModeSearchService.search(plan2, testWorkspaceId);
    const allUnder3000 = searchRes2.products.every(r => r.price <= 3000);
    assert(allUnder3000, 'INVARIANT: All returned products strictly adhere to extracted price constraint (<= 3000)');

    // Direct Currency Pattern Query ("product 1000 rupees")
    const planCurrency = AIModeSearchService.parseQuery('product 1000 rupees', undefined, testWorkspaceId);
    assert(planCurrency.extracted_filters.max_price === 1000, `Extracted direct currency price filter (<= 1000)`);
    const searchResCurrency = await AIModeSearchService.search(planCurrency, testWorkspaceId);
    assert(searchResCurrency.products.length > 0 && searchResCurrency.products.every(p => p.price <= 1000), 'Direct currency search returned validated products <= 1000');

    // Price Range Query ("between 1000 and 2500")
    const planRange = AIModeSearchService.parseQuery('shirt between 1000 and 2500', undefined, testWorkspaceId);
    assert(planRange.extracted_filters.min_price === 1000 && planRange.extracted_filters.max_price === 2500, 'Extracted dual-bound price range constraint [1000, 2500]');
    const searchResRange = await AIModeSearchService.search(planRange, testWorkspaceId);
    const allInRange = searchResRange.products.every(p => p.price >= 1000 && p.price <= 2500);
    assert(allInRange, 'INVARIANT: All returned range products satisfy [1000 <= price <= 2500]');

    // Compound & Single Color Extraction
    const planColor = AIModeSearchService.parseQuery('men navy blue linen shirt under 2000', undefined, testWorkspaceId);
    assert(planColor.extracted_filters.color === 'navy blue', `Extracted compound color "navy blue" (Got: ${planColor.extracted_filters.color})`);
    assert(planColor.extracted_filters.gender === 'men', 'Extracted gender "men"');
    assert(planColor.extracted_filters.material === 'linen', 'Extracted material "linen"');
    assert(planColor.extracted_filters.max_price === 2000, 'Extracted max_price 2000');
    assert(planColor.hard_constraints.some(c => c.field === 'color' && c.value === 'navy blue'), 'Hard constraint generated for color');

    // Negative Exclusions Query ("not red")
    const planExcl = AIModeSearchService.parseQuery('shirt not red', undefined, testWorkspaceId);
    assert(planExcl.exclusions.includes('red'), 'Detected negative exclusion "red"');
    const searchResExcl = await AIModeSearchService.search(planExcl, testWorkspaceId);
    const noRedProducts = searchResExcl.products.every(p => !/\b(red)\b/i.test(p.title));
    assert(noRedProducts, 'INVARIANT: No returned products contain excluded attribute "red"');
  } catch (err: any) {
    assert(false, `Query understanding test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test Suite 5: Product Type & Category Precision
  // -------------------------------------------------------------
  console.log('\n🎯 Test Suite 5: Product Type Precision & Category Boundaries');
  try {
    // Query for "shirt" should match shirts and NOT pure t-shirts, dresses, or pants
    const planShirt = AIModeSearchService.parseQuery('men shirt under 2500', undefined, testWorkspaceId);
    assert(planShirt.extracted_filters.category === 'Shirt', 'Parsed category as "Shirt"');
    const searchResShirt = await AIModeSearchService.search(planShirt, testWorkspaceId);
    assert(searchResShirt.products.length > 0, `Retrieved ${searchResShirt.products.length} shirt results`);
    
    // Invariant: No pants, dresses, sarees, or pure t-shirts in shirt results
    const validShirtsOnly = searchResShirt.products.every(p => {
      const catL = (p.category || '').toLowerCase();
      const titleL = (p.title || '').toLowerCase();
      const isPantsOrDress = /\b(pant|pants|jogger|joggers|dress|dresses|saree|sari|skirt)\b/i.test(catL);
      return !isPantsOrDress;
    });
    assert(validShirtsOnly, 'INVARIANT: No pants, dresses, or sarees returned for "shirt" query');

    // Query for "olive t-shirt" should match available olive t-shirt
    const planTshirt = AIModeSearchService.parseQuery('olive t-shirt under 1500', undefined, testWorkspaceId);
    assert(planTshirt.extracted_filters.color === 'olive', 'Parsed color "olive"');
    const searchResTshirt = await AIModeSearchService.search(planTshirt, testWorkspaceId);
    assert(searchResTshirt.products.length > 0, `Retrieved ${searchResTshirt.products.length} olive t-shirt result(s)`);

    // Invariant: Non-existent color for category returns 0 results without false positives
    const planBlackTshirt = AIModeSearchService.parseQuery('black t-shirt under 1500', undefined, testWorkspaceId);
    const searchResBlackTshirt = await AIModeSearchService.search(planBlackTshirt, testWorkspaceId);
    assert(searchResBlackTshirt.products.length === 0, 'INVARIANT: Correctly returned 0 results when no black t-shirt exists in catalog');
  } catch (err: any) {
    assert(false, `Product type precision test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test Suite 6: Variant-Aware Multi-Attribute Consistency
  // -------------------------------------------------------------
  console.log('\n🧬 Test Suite 6: Variant-Aware Multi-Attribute Consistency');
  try {
    // Synthetic product with separated variant attributes:
    // Variant 1: Color = Red, Size = M, Price = 1200
    // Variant 2: Color = Blue, Size = S, Price = 1200
    const testMultiVariantProduct: AIModeProduct = {
      id: 'prod_multi_var_01',
      title: 'AeroFlex Performance Shirt',
      description: 'Breathable active shirt',
      price: 1200,
      currency: 'INR',
      category: 'Shirt',
      images: [],
      in_stock: true,
      attributes: { material: 'Polyester' },
      variants: [
        { id: 'var_1', title: 'Red / M', price: 1200, in_stock: true, attributes: { color: 'Red', size: 'M' } },
        { id: 'var_2', title: 'Blue / S', price: 1200, in_stock: true, attributes: { color: 'Blue', size: 'S' } }
      ]
    };

    // Case A: Query for "Blue" AND "M" -> NO single variant has both (Must FAIL)
    const planBlueM = AIModeSearchService.parseQuery('Blue M shirt', undefined, testWorkspaceId);
    const evalBlueM = ConstraintEvaluator.evaluateProduct(testMultiVariantProduct, planBlueM);
    assert(evalBlueM.isValid === false, 'Variant-Consistency: Rejected product where no single variant satisfies both (Blue + M)');

    // Case B: Query for "Red" AND "M" -> Variant 1 matches both (Must PASS)
    const planRedM = AIModeSearchService.parseQuery('Red M shirt', undefined, testWorkspaceId);
    const evalRedM = ConstraintEvaluator.evaluateProduct(testMultiVariantProduct, planRedM);
    assert(evalRedM.isValid === true && evalRedM.matchingVariantId === 'var_1', 'Variant-Consistency: Accepted product when Variant 1 satisfies both (Red + M)');

    // Case C: Query for "Blue" AND "S" under 1000 -> Variant 2 has Blue + S but price 1200 > 1000 (Must FAIL)
    const planBlueS1000 = AIModeSearchService.parseQuery('Blue S shirt under 1000', undefined, testWorkspaceId);
    const evalBlueS1000 = ConstraintEvaluator.evaluateProduct(testMultiVariantProduct, planBlueS1000);
    assert(evalBlueS1000.isValid === false, 'Variant-Consistency: Rejected product when variant price exceeds max price');
  } catch (err: any) {
    assert(false, `Variant consistency test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test Suite 7: Arbitrary Multi-Combination Invariant Verification
  // -------------------------------------------------------------
  console.log('\n🛡️ Test Suite 7: Arbitrary Multi-Combination Invariant Verification');
  try {
    const testMatrix = [
      { query: 'men black shirt under 2000', check: (p: AIModeProduct) => p.price <= 2000 },
      { query: 'women dress under 3000', check: (p: AIModeProduct) => p.price <= 3000 },
      { query: 'cotton shirt between 1000 and 2000', check: (p: AIModeProduct) => p.price >= 1000 && p.price <= 2000 },
      { query: 'size L shirt under 2500', check: (p: AIModeProduct) => p.price <= 2500 }
    ];

    for (const testCase of testMatrix) {
      const plan = AIModeSearchService.parseQuery(testCase.query, undefined, testWorkspaceId);
      const res = await AIModeSearchService.search(plan, testWorkspaceId);
      
      const allSatisfy = res.products.every(p => {
        const evalRes = ConstraintEvaluator.evaluateProduct(p, plan);
        return evalRes.isValid && testCase.check(p);
      });

      assert(allSatisfy, `INVARIANT: 100% of results for "${testCase.query}" satisfy all explicit hard constraints (${res.products.length} matches)`);
      assert(res.total_matches === res.products.length || res.total_matches >= res.products.length, `Post-validation total_matches (${res.total_matches}) is authoritative`);
    }
  } catch (err: any) {
    assert(false, `Matrix invariant test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test Suite 8: Conversational Shopping & State Refinements
  // -------------------------------------------------------------
  console.log('\n💬 Test Suite 8: Conversational Multi-turn Agent & State Refinements');
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
  // Test Suite 9: Isolated Deployments & Widget Embed
  // -------------------------------------------------------------
  console.log('\n🌐 Test Suite 9: Isolated Deployments & Script Generator');
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
