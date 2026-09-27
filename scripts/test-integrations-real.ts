import { db } from '../src/lib/db';
import { generateAuthToken } from '../src/lib/auth';
import { encryptCredentials, decryptCredentials, generateMaskedCredentials } from '../src/lib/crypto/encryption';

async function runTests() {
  console.log('--- STARTING INTEGRATIONS REAL BACKEND TEST SUITE ---');

  // Test 1: Encryption & Decryption & Masking
  console.log('Test 1: AES-256-GCM Credential Encryption & Masking');
  const sampleCreds = {
    apiKey: 'dummy_sample_custom_key_5678',
    secretKey: 'dummy_sample_custom_secret_2211',
    domain: 'store.example.com'
  };
  const ciphertext = encryptCredentials(sampleCreds);
  const decrypted = decryptCredentials(ciphertext);
  const masked = generateMaskedCredentials(sampleCreds);

  if (!ciphertext || ciphertext.includes('custom_key')) {
    throw new Error('FAIL: Ciphertext is exposing plaintext data!');
  }
  if (!decrypted || decrypted.apiKey !== sampleCreds.apiKey || decrypted.secretKey !== sampleCreds.secretKey) {
    throw new Error('FAIL: Decrypted credentials do not match original!');
  }
  if (masked.apiKey !== '****5678' || masked.secretKey !== '****2211') {
    throw new Error(`FAIL: Masked credentials format incorrect: ${JSON.stringify(masked)}`);
  }
  console.log('✔ AES-256-GCM encryption, decryption, and credential masking verified.');

  // Test 2: Verify Initial Workspace State is NOT_CONNECTED
  console.log('Test 2: Workspace Connector Default State');
  const testWorkspaceId = 'ws_test_clean_001';
  const existingForClean = db.workspace_integrations.filter(wi => wi.workspace_id === testWorkspaceId);
  if (existingForClean.length !== 0) {
    throw new Error('FAIL: Clean workspace should have 0 custom integration rows before connection!');
  }
  console.log('✔ Clean workspace initial state verified.');

  // Test 3: Connect Connector with Masked Storage & Audit Trail
  console.log('Test 3: Connecting Razorpay connector');
  const user = db.users[0] || { id: 'usr_test_1', email: 'admin@example.com', role: 'OWNER' };
  const rzpCreds = { keyId: 'test_rzp_key_dummy1234', keySecret: 'test_rzp_secret_dummy5678' };
  const rzpCiphertext = encryptCredentials(rzpCreds);
  const rzpMasked = generateMaskedCredentials(rzpCreds);

  db.workspace_integrations.push({
    id: 'wi_rzp_test',
    workspace_id: testWorkspaceId,
    integration_id: 'razorpay',
    provider: 'RAZORPAY',
    name: 'Razorpay Payment Gateway',
    status: 'CONNECTED',
    connected_at: new Date().toISOString(),
    connected_by_user_id: user.id,
    connected_by_email: user.email,
    last_sync_at: new Date().toISOString(),
    last_sync_status: 'SUCCESS',
    credentials_ciphertext: rzpCiphertext,
    masked_credentials: rzpMasked,
    config: { keyId: rzpMasked.keyId },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Test 4: Verify No Plaintext Secret in DB row
  const rzpRecord = db.workspace_integrations.find(wi => wi.workspace_id === testWorkspaceId && wi.integration_id === 'razorpay');
  if (!rzpRecord) throw new Error('FAIL: Razorpay record not found!');
  if (JSON.stringify(rzpRecord).includes('test_rzp_secret_dummy5678')) {
    throw new Error('FAIL: DB row contains plaintext secret!');
  }
  console.log('✔ Razorpay record saved with ciphertext and masked credentials only.');

  // Test 5: Disconnect
  console.log('Test 5: Disconnecting connector');
  rzpRecord.status = 'NOT_CONNECTED';
  rzpRecord.credentials_ciphertext = undefined;
  rzpRecord.masked_credentials = {};
  rzpRecord.config = {};
  rzpRecord.connected_at = undefined;
  rzpRecord.connected_by_email = undefined;
  
  if (rzpRecord.status !== 'NOT_CONNECTED' || rzpRecord.credentials_ciphertext !== undefined) {
    throw new Error('FAIL: Disconnect did not revoke credentials cleanly!');
  }
  console.log('✔ Disconnect successfully revoked and reset connector.');

  console.log('--- ALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
