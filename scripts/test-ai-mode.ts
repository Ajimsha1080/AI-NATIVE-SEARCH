import { aiModeStorage } from '../src/ai-mode/services/storage';
import { AiModeKnowledgeService } from '../src/ai-mode/services/knowledge-service';
import { AiModeSearchService } from '../src/ai-mode/services/ai-search-service';
import { AiModeDeploymentService } from '../src/ai-mode/services/deployment-service';
import { AiModeChatService } from '../src/ai-mode/services/chat-service';
import { CatalogAdapter } from '../src/ai-mode/adapters/catalog-adapter';
import { CartAdapter } from '../src/ai-mode/adapters/cart-adapter';
import { db } from '../src/lib/db';
import { seedDatabaseIfEmpty } from '../src/lib/db/seed';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
  }
}

async function runAiModeTestSuite() {
  console.log('\n================================================================');
  console.log('  RUNNING AI MODE ISOLATED VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  await seedDatabaseIfEmpty();

  const workspaceId = db.workspaces[0]?.id || 'ws_acme_corp';
  const otherWorkspaceId = 'ws_test_isolated_tenant_99';

  // --- 1. AI Mode Configuration & Feature Flag ---
  console.log('--- 1. Configuration & Feature Flags ---');
  const initialConfig = aiModeStorage.getConfig(workspaceId);
  assert(initialConfig.enabled === true, 'Default AI Mode config is enabled');

  const updatedConfig = aiModeStorage.updateConfig(workspaceId, {
    temperature: 0.35,
    system_instructions: 'Custom enterprise shopping rules'
  });
  assert(updatedConfig.temperature === 0.35, 'Successfully updated AI Mode temperature');
  assert(updatedConfig.system_instructions === 'Custom enterprise shopping rules', 'Successfully updated custom system instructions');

  // --- 2. Knowledge Management & Sync ---
  console.log('\n--- 2. Knowledge Sources & Syncing ---');
  const newSource = await AiModeKnowledgeService.addSource(workspaceId, {
    type: 'WEBSITE_URL',
    name: 'Main Brand Catalog',
    url: 'https://example-shop.com/catalog'
  });
  assert(newSource.id.startsWith('aimode_ks_'), 'Generated valid AI Mode knowledge source ID');
  assert(newSource.status === 'READY', 'Knowledge source initially set to READY');

  const sourcesList = AiModeKnowledgeService.getSources(workspaceId);
  assert(sourcesList.some(s => s.id === newSource.id), 'Knowledge source listed in workspace sources');

  const synced = await AiModeKnowledgeService.syncSource(newSource.id, workspaceId);
  assert(synced?.status === 'READY', 'Knowledge source successfully synced');

  // --- 3. Hybrid AI Search & Dynamic Query Understanding ---
  console.log('\n--- 3. Hybrid AI Search & Dynamic Query Understanding ---');
  
  // Test natural query parsing (without hardcoded categories)
  const products = CatalogAdapter.getProductsByWorkspace(workspaceId);
  assert(products.length > 0, 'Catalog adapter retrieves catalog products safely');

  const weddingSearch = await AiModeSearchService.executeSearch(workspaceId, 'something elegant for a wedding');
  assert(weddingSearch.products.length > 0, 'Generic occasion query returns products');
  assert(weddingSearch.confidence_score > 0, 'Calculates non-zero confidence score');
  assert(weddingSearch.retrieval_diagnostics.latency_ms >= 0, 'Diagnostics report execution latency');

  // Test budget constraints
  const budgetSearch = await AiModeSearchService.executeSearch(workspaceId, 'shirts under 2000');
  assert(budgetSearch.products.length > 0, 'Budget query returns products');
  assert(budgetSearch.products.every(p => p.price <= 2000), 'Strictly satisfies max price constraint');

  // Test sorting
  const sortSearch = await AiModeSearchService.executeSearch(workspaceId, 'cheapest shirts');
  assert(sortSearch.products.length >= 2, 'Cheapest search returns multiple products');
  assert(sortSearch.products[0].price <= sortSearch.products[1].price, 'Sorted in ascending price order');

  // --- 4. Product Comparisons ---
  console.log('\n--- 4. Side-by-Side Product Comparison ---');
  const compProducts = products.slice(0, 2);
  const comparison = AiModeSearchService.compareProducts(compProducts);
  assert(comparison.products.length === 2, 'Compares requested products');
  assert(comparison.comparison_points.some(p => p.attribute === 'Price'), 'Includes price comparison point');
  assert(typeof comparison.summary === 'string' && comparison.summary.length > 0, 'Generates grounded comparison summary');

  // --- 5. Contextual Recommendations ---
  console.log('\n--- 5. Recommendation Engine ---');
  const recs = AiModeSearchService.getRecommendations(workspaceId, products[0], 3);
  assert(recs.length > 0, 'Generates recommendations based on reference product');
  assert(!recs.some(r => r.id === products[0].id), 'Excludes reference product from recommendations');

  // --- 6. Conversational Shopping & Multi-Turn State ---
  console.log('\n--- 6. Conversational Shopping Multi-Turn Flow ---');
  const testSessionId = `test_session_${Date.now()}`;

  // Turn 1: Initial Discovery
  const turn1 = await AiModeChatService.handleMessage(workspaceId, testSessionId, 'I am looking for shirts');
  assert(turn1.message.products !== undefined && turn1.message.products.length > 0, 'Turn 1 returns structured products');
  assert(turn1.conversation.context.last_products !== undefined, 'Stores last_products in conversation context');

  // Turn 2: Follow-up Comparison
  const turn2 = await AiModeChatService.handleMessage(workspaceId, testSessionId, 'compare the top products');
  assert(turn2.message.comparison !== undefined, 'Turn 2 generates structured comparison');

  // Turn 3: Add to Cart via Ordinal
  const turn3 = await AiModeChatService.handleMessage(workspaceId, testSessionId, 'add the first one to cart');
  assert(turn3.message.content.includes('added') || turn3.message.content.includes('cart'), 'Turn 3 executes cart addition');
  
  const activeCart = CartAdapter.getCart(workspaceId, testSessionId);
  assert(activeCart !== null && activeCart.items.length > 0, 'Cart adapter records added items in session cart');

  // --- 7. Deployment & Embed Code Security ---
  console.log('\n--- 7. Deployment & Embed Code Security ---');
  const deployments = AiModeDeploymentService.getDeployments(workspaceId);
  assert(deployments.length > 0, 'Retrieves or creates initial AI Mode deployment');

  const deployment = deployments[0];
  assert(deployment.id.startsWith('aimode_dep_'), 'Valid deployment identifier format');

  const snippets = AiModeDeploymentService.generateEmbedSnippets(deployment.id, 'https://mystore.com');
  assert(snippets.scriptTag.includes('/api/ai-mode/widget/'), 'Script tag references dedicated AI Mode script endpoint');
  assert(snippets.iframeTag.includes('/ai-mode/embed/'), 'iFrame tag references dedicated AI Mode embed URL');

  // Origin security checks
  const allowAllOrigin = AiModeDeploymentService.isOriginAllowed({ ...deployment, allowed_domains: ['*'] }, 'https://external-store.com');
  assert(allowAllOrigin === true, 'Wildcard domain allowlist permits origins');

  const restrictedOriginPass = AiModeDeploymentService.isOriginAllowed({ ...deployment, allowed_domains: ['brandstore.com'] }, 'https://brandstore.com');
  assert(restrictedOriginPass === true, 'Matching domain allowlist permits origin');

  const restrictedOriginFail = AiModeDeploymentService.isOriginAllowed({ ...deployment, allowed_domains: ['brandstore.com'] }, 'https://malicious-site.com');
  assert(restrictedOriginFail === false, 'Mismatched domain correctly rejected');

  // --- 8. Multi-Tenant Workspace Isolation ---
  console.log('\n--- 8. Multi-Tenant Workspace Isolation ---');
  const tenantBSources = AiModeKnowledgeService.getSources(otherWorkspaceId);
  assert(!tenantBSources.some(s => s.id === newSource.id), 'Workspace B cannot see Workspace A knowledge sources');

  const tenantBDeployments = aiModeStorage.getDeployments(otherWorkspaceId);
  assert(!tenantBDeployments.some(d => d.id === deployment.id), 'Workspace B cannot see Workspace A deployments');

  // Clean up test source
  AiModeKnowledgeService.removeSource(newSource.id, workspaceId);

  console.log('\n================================================================');
  console.log(`  AI MODE TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAiModeTestSuite().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
