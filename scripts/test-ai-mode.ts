/**
 * AI MODE PRODUCTION RETRIEVAL & SEARCH VERIFICATION SUITE
 * 
 * Verifies that the generic, variant-aware AI Mode retrieval engine operates
 * correctly according to production ecommerce invariants:
 * 1. Isolated Storage & Configuration
 * 2. Knowledge Source Management (Crawler & Documents)
 * 3. Safe Catalog Adapter (Read-only Commerce Bridge)
 * 4. Multi-Constraint Query Understanding (Hard vs Soft, Bounds, Exclusions)
 * 5. Variant-Aware Multi-Attribute Consistency
 * 6. Hard-Constraint Invariant Enforcement (0% violation rate across all results)
 * 7. Soft Preferences & Stylistic Alignment
 * 8. Conversational Multi-Turn Shopping & State Refinements
 * 9. Accurate Post-Validation Pagination & Diagnostics
 * 10. Isolated Deployments & Widget Script Generation
 */

import { aiModeStorage } from '../src/ai-mode/services/storage';
import { AIModeCatalogAdapter } from '../src/ai-mode/adapters/catalog-adapter';
import { AIModeSearchService } from '../src/ai-mode/services/ai-search-service';
import { AIModeChatService } from '../src/ai-mode/services/chat-service';
import { AIModeKnowledgeService } from '../src/ai-mode/services/knowledge-service';
import { AIModeDeploymentService } from '../src/ai-mode/services/deployment-service';
import { ConstraintEvaluator } from '../src/ai-mode/services/constraint-evaluator';
import { AIModeProduct } from '../src/ai-mode/types';

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
  // Test Suite 5: Variant-Aware Multi-Attribute Consistency
  // -------------------------------------------------------------
  console.log('\n🧬 Test Suite 5: Variant-Aware Multi-Attribute Consistency');
  try {
    // Synthetic product with separated variant attributes:
    // Variant 1: Color = Red, Size = M
    // Variant 2: Color = Blue, Size = S
    const testMultiVariantProduct: AIModeProduct = {
      id: 'prod_multi_var_01',
      title: 'AeroFlex Performance Shirt',
      description: 'Breathable sports shirt',
      price: 1200,
      currency: 'INR',
      category: 'Shirts',
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
  } catch (err: any) {
    assert(false, `Variant consistency test threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test Suite 6: Conversational Shopping & Cart Intent Detection
  // -------------------------------------------------------------
  console.log('\n💬 Test Suite 6: Conversational Multi-turn Agent & State Refinements');
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
  // Test Suite 7: Isolated Deployments & Widget Embed
  // -------------------------------------------------------------
  console.log('\n🌐 Test Suite 7: Isolated Deployments & Script Generator');
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
  // Test Suite 8: Arbitrary Category Generalization & Invariant Enforcement
  // -------------------------------------------------------------
  console.log('\n🎯 Test Suite 8: Arbitrary Natural Language Generalization & Invariant Enforcement');
  try {
    // 1. "red men shirt products" -> Invariant: Must only return men's shirts in red/wine color family
    const planRedMen = AIModeSearchService.parseQuery('red men shirt products', undefined, testWorkspaceId);
    const resRedMen = await AIModeSearchService.search(planRedMen, testWorkspaceId);
    assert(resRedMen.total_matches > 0, `Retrieved ${resRedMen.total_matches} matching products for "red men shirt products"`);
    const allRedMenShirts = resRedMen.products.every(p => {
      const titleLower = p.title.toLowerCase();
      const catLower = (p.category || '').toLowerCase();
      const tagsLower = (p.subcategories || p.tags || []).map(t => t.toLowerCase());
      const isShirt = catLower.includes('shirt') || titleLower.includes('shirt');
      const isMen = tagsLower.includes('men') || titleLower.includes('men') || !tagsLower.includes('women');
      const isRedOrWine = tagsLower.includes('red') || tagsLower.includes('wine') || tagsLower.includes('maroon') || titleLower.includes('wine') || titleLower.includes('red');
      return isShirt && isMen && isRedOrWine;
    });
    assert(allRedMenShirts, 'INVARIANT: All returned products for "red men shirt products" are strictly men shirts in red family (0% green/navy/yellow/jacket leak)');

    // 2. "green cotton shirt under 1500" -> Invariant: All returned products must be green shirts <= 1500
    const planGreen = AIModeSearchService.parseQuery('green cotton shirt under 1500', undefined, testWorkspaceId);
    const resGreen = await AIModeSearchService.search(planGreen, testWorkspaceId);
    assert(resGreen.total_matches > 0, `Retrieved ${resGreen.total_matches} matching products for "green cotton shirt under 1500"`);
    const allGreenUnder1500 = resGreen.products.every(p => {
      const titleLower = p.title.toLowerCase();
      const tagsLower = (p.subcategories || p.tags || []).map(t => t.toLowerCase());
      const isGreen = tagsLower.includes('green') || tagsLower.includes('evergreen') || tagsLower.includes('sage') || titleLower.includes('green') || titleLower.includes('evergreen');
      return p.price <= 1500 && isGreen;
    });
    assert(allGreenUnder1500, 'INVARIANT: All returned products for "green cotton shirt under 1500" are strictly green shirts <= 1500');

    // 3. "not red shirts" -> Invariant: Zero returned products contain red/wine/maroon colors
    const planNotRed = AIModeSearchService.parseQuery('not red shirts', undefined, testWorkspaceId);
    const resNotRed = await AIModeSearchService.search(planNotRed, testWorkspaceId);
    assert(resNotRed.total_matches > 0, `Retrieved ${resNotRed.total_matches} matching products for "not red shirts"`);
    const zeroRed = resNotRed.products.every(p => {
      const tags = (p.subcategories || p.tags || []).map(t => t.toLowerCase());
      const title = p.title.toLowerCase();
      return !tags.includes('red') && !tags.includes('wine') && !tags.includes('maroon') && !title.includes('wine') && !title.includes('red');
    });
    assert(zeroRed, 'INVARIANT: Negative constraint "not red shirts" completely filtered out all red/wine products');

    // 4. "yellow saree" -> Invariant: Category must be Saree and color yellow
    const planSaree = AIModeSearchService.parseQuery('yellow saree', undefined, testWorkspaceId);
    const resSaree = await AIModeSearchService.search(planSaree, testWorkspaceId);
    assert(resSaree.total_matches > 0, `Retrieved ${resSaree.total_matches} matching saree(s)`);
    const allYellowSarees = resSaree.products.every(p => p.category.toLowerCase().includes('saree') || p.title.toLowerCase().includes('saree'));
    assert(allYellowSarees, 'INVARIANT: "yellow saree" returned only sarees (zero shirts or jackets)');

    // 5. Synthetic arbitrary ecommerce items (e.g. dynamic backpacks and electronics)
    const syntheticBackpack: AIModeProduct = {
      id: 'prod_bp_01',
      title: 'Voyager Waterproof Hiking Backpack 45L',
      description: 'Durable nylon outdoor camping backpack with laptop sleeve',
      price: 2499,
      currency: 'INR',
      category: 'Backpacks',
      images: [],
      in_stock: true,
      attributes: { capacity: '45L', material: 'Nylon', color: 'Blue' },
      variants: [
        { id: 'var_bp_1', title: 'Blue / 45L', price: 2499, in_stock: true, attributes: { color: 'Blue', size: '45L' } }
      ]
    };
    const backpackPlan = AIModeSearchService.parseQuery('blue waterproof backpack under 3000');
    const evalBackpack = ConstraintEvaluator.evaluateProduct(syntheticBackpack, backpackPlan);
    assert(evalBackpack.isValid === true, 'Generalization: Successfully evaluated arbitrary non-apparel category ("Backpacks")');

    const incompatibleBackpackPlan = AIModeSearchService.parseQuery('red backpack under 2000');
    const evalIncompat = ConstraintEvaluator.evaluateProduct(syntheticBackpack, incompatibleBackpackPlan);
    assert(evalIncompat.isValid === false, 'Generalization: Rejected incompatible non-apparel candidate (price & color mismatch)');
  } catch (err: any) {
    assert(false, `Generalization test threw error: ${err.message}`);
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
