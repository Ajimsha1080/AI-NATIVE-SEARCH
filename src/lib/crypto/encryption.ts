import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 
                 process.env.SERVICE_JWT_SECRET || 
                 process.env.SESSION_JWT_SECRET || 
                 'secure_encryption_key_32bytes_enterprise_aaas';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts credentials object at rest using AES-256-GCM
 */
export function encryptCredentials(data: Record<string, any>): string {
  if (!data || Object.keys(data).length === 0) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const jsonStr = JSON.stringify(data);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts credentials ciphertext
 */
export function decryptCredentials(ciphertext?: string | null): Record<string, any> | null {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.includes(':')) return null;
  try {
    const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    return null;
  }
}

/**
 * Masks raw secret to safe UI identifier (e.g. "****9a08")
 */
export function maskSecret(val?: string): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (trimmed.length <= 6) return '****';
  return `****${trimmed.slice(-4)}`;
}

/**
 * Generates safe masked credentials dictionary for API responses
 */
export function generateMaskedCredentials(creds: Record<string, any> = {}): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (typeof v === 'string') {
      if (/secret|token|key|password|auth/i.test(k)) {
        masked[k] = maskSecret(v);
      } else {
        masked[k] = v;
      }
    }
  }
  return masked;
}
