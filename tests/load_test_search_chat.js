import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 virtual users
    { duration: '1m', target: 50 },   // Sustained load at 50 virtual users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% of requests must complete within 400ms
    http_req_failed: ['rate<0.01'],   // Error rate must remain below 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';
const DEPLOYMENT_KEY = __ENV.DEPLOYMENT_KEY || 'dep_test_live_key';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'X-Deployment-Key': DEPLOYMENT_KEY,
  };

  // 1. Search Query
  const searchPayload = JSON.stringify({
    query: 'oversized cotton t-shirt',
    page: 1,
    page_size: 24,
  });

  const searchRes = http.post(`${BASE_URL}/api/v1/ai-mode/search`, searchPayload, { headers });
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search returns products': (r) => JSON.parse(r.body).products !== undefined,
  });

  sleep(1);

  // 2. Chat Query
  const chatPayload = JSON.stringify({
    user_message: 'Do you offer returns for unwashed items?',
  });

  const chatRes = http.post(`${BASE_URL}/api/v1/ai-mode/chat`, chatPayload, { headers });
  check(chatRes, {
    'chat status is 200': (r) => r.status === 200,
    'chat returns content': (r) => JSON.parse(r.body).content !== undefined,
  });

  sleep(1);
}
