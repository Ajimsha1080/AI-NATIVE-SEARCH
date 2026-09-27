import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seedDatabaseIfEmpty } from '@/lib/db/seed';
import { 
  verifyPassword, 
  createSessionToken, 
  AUTH_COOKIE_NAME, 
  checkLoginRateLimit, 
  recordFailedLoginAttempt, 
  resetLoginRateLimit 
} from '@/lib/auth';

export async function POST(req: Request) {
  try {
    if (db.users.length === 0 || db.commerce_products.length === 0) {
      await seedDatabaseIfEmpty();
    }
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: { message: 'Email and password are required' } }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Rate Limiting & Account Lockout Defense
    const rateCheck = checkLoginRateLimit(cleanEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: { 
          message: `Too many failed login attempts. Account temporarily locked for security. Please retry in ${rateCheck.retryAfterSec} seconds.` 
        }
      }, { status: 429 });
    }

    // 2. Constant-time user lookup & verification
    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      recordFailedLoginAttempt(cleanEmail);
      return NextResponse.json({ error: { message: 'Invalid email or password' } }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      const lockStatus = recordFailedLoginAttempt(cleanEmail);
      if (lockStatus.locked) {
        return NextResponse.json({ 
          error: { message: 'Account locked for 15 minutes due to consecutive failed authentication attempts.' } 
        }, { status: 429 });
      }
      return NextResponse.json({ error: { message: 'Invalid email or password' } }, { status: 401 });
    }

    // Enforce email verification in production
    if (process.env.NODE_ENV === 'production' && process.env.APP_ENV === 'production' && user.email_verified === false) {
      return NextResponse.json({
        error: { message: 'Please verify your email address before logging in. Check your inbox for the verification link.' }
      }, { status: 403 });
    }

    // Reset rate limiter on successful authentication
    resetLoginRateLimit(cleanEmail);

    const membership = db.workspace_members.find(m => m.user_id === user.id);
    const workspaceId = membership ? membership.workspace_id : db.workspaces[0]?.id || 'ws_acme_corp';

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      workspaceId,
      isSuperAdmin: user.is_super_admin
    });

    const response = NextResponse.json({
      success: true,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        avatar_url: user.avatar_url, 
        is_super_admin: user.is_super_admin 
      },
      workspace_id: workspaceId
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: { message: 'Authentication service error' } }, { status: 500 });
  }
}
