process.env.APP_ENV = 'development';
process.env.NODE_ENV = 'development';

import { createSessionToken } from '../src/lib/auth';
import fs from 'fs';

async function main() {
  console.log('Generating session token...');
  const token = await createSessionToken({
    userId: 'usr_mukb55d69dbgwsri',
    email: 'ajimshaptpm16@gmail.com',
    workspaceId: 'ws_mukb55d6tbd8eeoy'
  });

  const testQueries = [
    'what is your return and exchange policy?',
    'how can I contact customer support and where are you located?',
    'show me new sunscreen jackets',
    'how many days does delivery take across India?',
    'who is Blue Tyga and what do you sell?'
  ];

  console.log('Testing queries against /api/agents/agent_mukb55d/chat...');
  for (const q of testQueries) {
    console.log('\n======================================================');
    console.log('Shopper Query:', q);
    const start = Date.now();
    try {
      const res = await fetch('http://localhost:3000/api/agents/agent_mukb55d/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `aaas_session_token=${token}`
        },
        body: JSON.stringify({ message: q })
      });
      const data = await res.json();
      console.log(`HTTP ${res.status} (${Date.now() - start}ms)`);
      console.log('Response:');
      console.log(data.response_text || data.response);
      if (data.interactive_payload?.data) {
        console.log('Interactive Products:', data.interactive_payload.data.map((p: any) => `${p.title} (₹${p.price})`));
      }
    } catch (err: any) {
      console.error('Error during query:', err.message);
    }
  }
}

main();
