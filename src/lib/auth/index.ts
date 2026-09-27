import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db';
import { seedDatabaseIfEmpty } from '../db/seed';
import { User, WorkspaceRole } from '@/types';

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'aaas_session_token';

export const DISALLOWED_DEFAULT_SECRETS = [
  'super_secret_jwt_key_enterprise_grade_aaas_platform_2026',
  'super_secret_jwt_key_change_in_production',
  'secret',
  'changeme',
  'password',
  'test',
  'admin',
  '12345678901234567890123456789012'
];

export function validateSecretStrength(secret: string | undefined, name: string): string {
  if (!secret || secret.trim().length === 0) {
    throw new Error(`Security Error: Environment variable '${name}' is missing or empty.`);
  }
  if (secret.length < 32) {
    throw new Error(`Security Error: Environment variable '${name}' must be at least 32 characters long.`);
  }
  if (DISALLOWED_DEFAULT_SECRETS.includes(secret.trim())) {
    throw new Error(`Security Error: Environment variable '${name}' is using a known insecure default secret.`);
  }
  return secret;
}

// Session JWT Secret for End-User App Sessions
export function getSessionJwtSecret(): Uint8Array {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV;
  const raw = process.env.SESSION_JWT_SECRET || process.env.JWT_SECRET;
  if (!raw) {
    if (appEnv === 'development') {
      // Strict default strictly for local development testing with 32+ bytes
      return new TextEncoder().encode('development_only_session_secret_32bytes_long!');
    }
    throw new Error(
      'Security Error: SESSION_JWT_SECRET is missing. Explicit APP_ENV=development is required to use local fallback secrets.'
    );
  }
  validateSecretStrength(raw, 'SESSION_JWT_SECRET');
  return new TextEncoder().encode(raw);
}

// Service-to-Service JWT Secret for Node <-> Python Backend Communication
export function getServiceJwtSecret(): Uint8Array {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV;
  const raw = process.env.SERVICE_JWT_SECRET || process.env.INTERNAL_SERVICE_SECRET || process.env.JWT_SECRET;
  if (!raw) {
    if (appEnv === 'development') {
      return new TextEncoder().encode('development_only_service_secret_32bytes_long!');
    }
    throw new Error(
      'Security Error: SERVICE_JWT_SECRET is missing. Explicit APP_ENV=development is required to use local fallback secrets.'
    );
  }
  validateSecretStrength(raw, 'SERVICE_JWT_SECRET');
  return new TextEncoder().encode(raw);
}

export function validateBootSecrets(): void {
  getSessionJwtSecret();
  getServiceJwtSecret();
  const { getEncryptionKey } = require('../crypto/encryption');
  getEncryptionKey();
}

// In-Memory Login Rate Limiting & Lockout Store (Production uses Redis)
interface RateLimitRecord {
  attempts: number;
  lockedUntil?: number;
}
const loginAttemptsMap = new Map<string, RateLimitRecord>();

export function checkLoginRateLimit(identifier: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = loginAttemptsMap.get(identifier);

  if (record && record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

export function recordFailedLoginAttempt(identifier: string): { locked: boolean; lockedUntil?: number } {
  const now = Date.now();
  const record = loginAttemptsMap.get(identifier) || { attempts: 0 };
  record.attempts += 1;

  if (record.attempts >= 5) {
    // 15-minute temporary lockout
    record.lockedUntil = now + 15 * 60 * 1000;
    loginAttemptsMap.set(identifier, record);
    return { locked: true, lockedUntil: record.lockedUntil };
  }

  loginAttemptsMap.set(identifier, record);
  return { locked: false };
}

export function resetLoginRateLimit(identifier: string): void {
  loginAttemptsMap.delete(identifier);
}

export function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one numeric digit.' };
  }
  if (!/[A-Z!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter or special character.' };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: {
  userId: string;
  email: string;
  workspaceId?: string;
  isSuperAdmin?: boolean;
}): Promise<string> {
  const secret = getSessionJwtSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('aaas-auth')
    .setAudience('aaas-app')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function createServiceJwt(
  workspaceId: string,
  userId: string = 'service_node',
  role: string = 'ADMIN'
): Promise<string> {
  const secret = getServiceJwtSecret();
  return new SignJWT({
    workspace_id: workspaceId,
    workspaceId: workspaceId,
    sub: userId,
    userId: userId,
    role: role,
    isSuperAdmin: role === 'SUPERADMIN'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('aaas-node')
    .setAudience('aaas-python')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<{
  userId: string;
  email: string;
  workspaceId?: string;
  isSuperAdmin?: boolean;
} | null> {
  try {
    const secret = getSessionJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'aaas-auth',
      audience: 'aaas-app',
      clockTolerance: 60
    });
    return payload as any;
  } catch (e) {
    return null;
  }
}

export async function verifyServiceJwt(token: string): Promise<{
  workspace_id: string;
  userId: string;
  role: string;
  isSuperAdmin?: boolean;
} | null> {
  try {
    const secret = getServiceJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'aaas-node',
      audience: 'aaas-python',
      clockTolerance: 60
    });
    return payload as any;
  } catch (e) {
    return null;
  }
}

export async function getAuthSession(req?: Request): Promise<{
  user: User;
  workspaceId: string;
  role: WorkspaceRole;
} | null> {
  let token: string | null = null;
  if (req) {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      const cookieHeader = req.headers.get('cookie') || '';
      const regex = new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`);
      const match = cookieHeader.match(regex);
      if (match) {
        token = match[1];
      }
    }
  }

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload && payload.userId) {
      const user = db.users.find(u => u.id === payload.userId);
      if (user) {
        if (payload.workspaceId) {
          // Explicit workspace membership check
          const member = db.workspace_members.find(
            m => m.workspace_id === payload.workspaceId && m.user_id === user.id
          );
          if (member || user.is_super_admin) {
            const role: WorkspaceRole = user.is_super_admin ? 'OWNER' : (member?.role || 'VIEWER');
            return { user, workspaceId: payload.workspaceId, role };
          }
          // Non-member trying to access target workspace -> strictly return null (401/403)
          return null;
        }

        // If no workspace specified in token, find the user's primary membership
        const userMembership = db.workspace_members.find(m => m.user_id === user.id);
        if (userMembership) {
          return {
            user,
            workspaceId: userMembership.workspace_id,
            role: user.is_super_admin ? 'OWNER' : userMembership.role
          };
        }

        if (user.is_super_admin && db.workspaces.length > 0) {
          return {
            user,
            workspaceId: db.workspaces[0].id,
            role: 'OWNER'
          };
        }
      }
    }
  }

  return null;
}

export function requireRole(
  session: any,
  allowedRoles: WorkspaceRole[]
): boolean {
  if (!session) return false;
  if (session.user?.is_super_admin || session.role === 'OWNER') return true;
  if (session.role && allowedRoles.includes(session.role)) return true;
  return false;
}

export const ALLOWED_API_KEY_PERMISSIONS = [
  'read:catalog',
  'write:catalog',
  'read:orders',
  'write:orders',
  'execute:agent',
  'read:knowledge',
  'write:knowledge',
  'admin'
];

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateSecureApiKey(prefix: string = 'ak_live'): { rawKey: string; keyPrefix: string; hashedKey: string } {
  const randomHex = crypto.randomBytes(24).toString('hex');
  const rawKey = `${prefix}_${randomHex}`;
  const keyPrefix = rawKey.substring(0, 12);
  const hashedKey = hashApiKey(rawKey);
  return { rawKey, keyPrefix, hashedKey };
}

export async function verifyApiKey(key: string): Promise<{
  workspaceId: string;
  permissions: string[];
} | null> {
  if (!key) return null;

  const keyHash = hashApiKey(key);

  for (const stored of db.api_keys) {
    if (stored.hashed_key) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(stored.hashed_key, 'utf-8'), Buffer.from(keyHash, 'utf-8'))) {
          return {
            workspaceId: stored.workspace_id,
            permissions: stored.permissions
          };
        }
      } catch {}
    } else if (key.startsWith(stored.key_prefix)) {
      // Legacy compatibility
      return {
        workspaceId: stored.workspace_id,
        permissions: stored.permissions
      };
    }
  }
  return null;
}
