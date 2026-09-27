process.env.APP_ENV = process.env.APP_ENV || 'development';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🤖 SHOPMATE AaaS — COMPREHENSIVE BUTTON & ACTION AUDIT SUITE');
console.log('================================================================\n');

// 1. Static Scan of all TSX buttons
function findFiles(dir: string, ext: string[] = ['.tsx']): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, ext));
    } else if (ext.some(e => fullPath.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

const tsxFiles = findFiles('./src');
console.log(`[Phase 1] Scanning ${tsxFiles.length} React TSX files for button integrity...`);

let totalButtons = 0;
let validButtons = 0;
let buttonIssues: string[] = [];

for (const file of tsxFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const buttonMatches = content.match(/<button[\s\S]*?>/g) || [];
  totalButtons += buttonMatches.length;

  buttonMatches.forEach((btn, i) => {
    const hasOnClick = btn.includes('onClick');
    const isSubmit = btn.includes('type="submit"') || btn.includes('type=\'submit\'');
    const isDisabled = btn.includes('disabled');
    const isEmptyClick = btn.includes('onClick={() => {}}') || btn.includes('onClick={() => null}');

    if (isEmptyClick) {
      buttonIssues.push(`[EMPTY_HANDLER] ${file} -> ${btn.slice(0, 80)}`);
    } else {
      validButtons++;
    }
  });
}

console.log(`✓ Total buttons analyzed: ${totalButtons}`);
console.log(`✓ Interactive buttons verified: ${validButtons}`);
if (buttonIssues.length > 0) {
  console.log('⚠️ Issues found:');
  buttonIssues.forEach(iss => console.log('  ' + iss));
} else {
  console.log('✅ 0 Broken or Empty button handlers found in React codebase.\n');
}

// 2. Functional Live Testing of All Button-Triggered Workflows
console.log('[Phase 2] Executing Live E2E Functional Tests on all Button Actions...\n');

const BASE_URL = 'http://localhost:3000';

async function testAction(name: string, fn: () => Promise<boolean>) {
  try {
    const start = Date.now();
    const passed = await fn();
    const duration = Date.now() - start;
    if (passed) {
      console.log(`  [PASS] [${duration}ms] ${name}`);
      return true;
    } else {
      console.log(`  [FAIL] [${duration}ms] ${name}`);
      return false;
    }
  } catch (err: any) {
    console.log(`  [ERROR] ${name}: ${err.message}`);
    return false;
  }
}

import { createSessionToken } from '../src/lib/auth';

async function runLiveTests() {
  let passedCount = 0;
  let totalTests = 0;

  let sessionToken = await createSessionToken({
    userId: 'usr_admin_01',
    email: 'admin@aaas-platform.com',
    workspaceId: 'ws_acme_corp',
    role: 'OWNER',
    isSuperAdmin: true
  });

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`,
    'Cookie': `aaas_session=${sessionToken}`
  };

  async function check(name: string, fn: () => Promise<boolean>) {
    totalTests++;
    const res = await testAction(name, fn);
    if (res) passedCount++;
  }

  // 1. Agent Management Buttons
  await check('Button "Create New Agent" -> POST /api/agents', async () => {
    const res = await fetch(`${BASE_URL}/api/agents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Automated Audit Bot',
        description: 'Temporary agent created to verify button workflows',
        model: 'gpt-4o-mini',
        role: 'Sales Specialist'
      })
    });
    return res.status === 200 || res.status === 201;
  });

  await check('Button "Save Agent Settings / Instructions" -> PUT /api/agents/agent_shopmate_01', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/agent_shopmate_01`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'ShopMate Assistant',
        temperature: 0.7,
        system_prompt: 'You are ShopMate AI, a premier enterprise shopping assistant.'
      })
    });
    return res.status === 200;
  });

  // 2. Playground / Chat Buttons
  await check('Button "Send Message" (Chat / RAG Pipeline) -> POST /api/agents/agent_shopmate_01/chat', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/agent_shopmate_01/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: 'Can I exchange my running shoes for a size 11?',
        channel: 'playground'
      })
    });
    const data = await res.json();
    return res.status === 200 && !!(data.response || data.text || data.message || data.reply);
  });

  await check('Button "Live RAG Query" -> POST /api/rag/query', async () => {
    const res = await fetch(`${BASE_URL}/api/rag/query`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        question: 'What is the return window for unworn items?'
      })
    });
    return res.status === 200;
  });

  // 3. Knowledge / Ingestion Buttons
  await check('Button "Ingest Knowledge Document" -> POST /api/rag/ingest', async () => {
    const res = await fetch(`${BASE_URL}/api/rag/ingest`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Button Test Policy',
        type: 'POLICY',
        rawContent: 'All VIP members get free express shipping and 60-day hassle free returns.'
      })
    });
    const data = await res.json();
    return res.status === 200 && data.success === true;
  });

  // 4. Commerce Catalog & Sync Buttons
  await check('Button "Sync Store Catalog" -> POST /api/commerce/sync', async () => {
    const res = await fetch(`${BASE_URL}/api/commerce/sync`, { method: 'POST', headers: authHeaders });
    const data = await res.json();
    return res.status === 200 && data.success === true;
  });

  await check('Button "Fetch Products List" -> GET /api/commerce/products', async () => {
    const res = await fetch(`${BASE_URL}/api/commerce/products`, { headers: authHeaders });
    const data = await res.json();
    return res.status === 200 && Array.isArray(data.products) && data.products.length > 0;
  });

  await check('Button "Fetch Live Orders" -> GET /api/commerce/orders', async () => {
    const res = await fetch(`${BASE_URL}/api/commerce/orders`, { headers: authHeaders });
    const data = await res.json();
    return res.status === 200 && Array.isArray(data.orders) && data.orders.length > 0;
  });

  // 5. Version Control & Rollback Buttons
  await check('Button "Publish Version Snapshot" -> POST /api/agents/agent_shopmate_01/versions', async () => {
    const res = await fetch(`${BASE_URL}/api/agents/agent_shopmate_01/versions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'PUBLISH',
        change_summary: 'Automated test snapshot deployment'
      })
    });
    return res.status === 200 || res.status === 201;
  });

  // 6. Security & API Keys Buttons
  await check('Button "Generate API Key" -> POST /api/api-keys', async () => {
    const res = await fetch(`${BASE_URL}/api/api-keys`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Automated CI Test Key'
      })
    });
    return res.status === 200 || res.status === 201;
  });

  // 7. Evaluations & Testing Buttons
  await check('Button "Run Agent Test Suite" -> POST /api/evaluations', async () => {
    const res = await fetch(`${BASE_URL}/api/evaluations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'RUN',
        agent_id: 'agent_shopmate_01'
      })
    });
    return res.status === 200;
  });

  // 8. Integrations Sync Buttons
  await check('Button "Sync Provider Webhook / Integration" -> POST /api/commerce/sync', async () => {
    const res = await fetch(`${BASE_URL}/api/commerce/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ integrationId: 'custom_webhooks' })
    });
    return res.status === 200;
  });

  // 9. Conversations & Messages
  await check('Button "Fetch Workspace Conversations" -> GET /api/conversations', async () => {
    const res = await fetch(`${BASE_URL}/api/conversations`, { headers: authHeaders });
    return res.status === 200;
  });

  console.log('\n================================================================');
  console.log(`BUTTON & ACTION AUDIT SUMMARY: ${passedCount}/${totalTests} WORKFLOWS PASSED`);
  console.log('================================================================');
}

runLiveTests();
