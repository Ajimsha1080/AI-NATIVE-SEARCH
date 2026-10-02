import { runAgentCycle } from '../src/lib/agent-runtime';
import { db } from '../src/lib/db';

async function testBuyNow() {
  console.log('Testing AI Buy Now flow...');
  const wsId = 'ws_acme_corp';
  const agent = db.agents.find(a => a.workspace_id === wsId) || db.agents[0];

  // 1. First search
  console.log('1. Searching for shirts...');
  const res1 = await runAgentCycle({
    agent_id: agent.id,
    workspace_id: wsId,
    user_message: 'Show me cotton shirts'
  });

  const rawProducts = res1.interactive_payload?.data || res1.metadata?.products;
  console.log('Matched products:', rawProducts?.length || 0);

  // 2. Conversational Buy Now: "buy the second one"
  console.log('\n2. Testing "buy the second one":');
  const res2 = await runAgentCycle({
    agent_id: agent.id,
    workspace_id: wsId,
    conversation_id: res1.conversation_id,
    user_message: 'buy the second one'
  });

  console.log('Res2 Payload Type:', res2.interactive_payload?.type);
  console.log('Res2 Resolved Product:', res2.interactive_payload?.data?.product?.title);
  console.log('Res2 Response text:', res2.response_text);

  // 3. Conversational Buy Now: "I want this one"
  console.log('\n3. Testing "I want this one":');
  const res3 = await runAgentCycle({
    agent_id: agent.id,
    workspace_id: wsId,
    conversation_id: res1.conversation_id,
    user_message: 'I want this one'
  });

  console.log('Res3 Payload Type:', res3.interactive_payload?.type);
  console.log('Res3 Resolved Product:', res3.interactive_payload?.data?.product?.title);

  if (res2.interactive_payload?.type === 'CHECKOUT_SESSION' && res3.interactive_payload?.type === 'CHECKOUT_SESSION') {
    console.log('\n✨ ALL BUY NOW CONVERSATIONAL TESTS PASSED!');
  } else {
    console.error('\n❌ Buy Now test failed: expected CHECKOUT_SESSION payload');
    process.exit(1);
  }
}

testBuyNow().catch((err) => {
  console.error(err);
  process.exit(1);
});
