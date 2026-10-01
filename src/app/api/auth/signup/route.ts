import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { hashPassword, createSessionToken, validatePasswordPolicy, AUTH_COOKIE_NAME } from '@/lib/auth';
import { generateId } from '@/lib/utils';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyCaptchaToken } from '@/lib/security/captcha';
import { sendVerificationEmail } from '@/lib/email';
import { STANDARD_TOOLS } from '@/lib/db/seed';

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local_ip';
    
    // 1. IP-based Signup Rate Limiting (5 signups per 15 minutes)
    const ipLimit = await checkRateLimit(`signup_ip:${clientIp}`, 5, 15 * 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: { message: `Too many registration attempts from this IP. Please try again in ${ipLimit.retryAfterSec} seconds.` } },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, password, workspace_name, workspaceName, captcha_token } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ error: { message: 'Name, email, and password are required' } }, { status: 400 });
    }

    // 2. CAPTCHA Verification (Turnstile / hCaptcha)
    const captchaCheck = await verifyCaptchaToken(captcha_token, clientIp);
    if (!captchaCheck.success) {
      return NextResponse.json({ error: { message: captchaCheck.error || 'Anti-bot verification failed.' } }, { status: 400 });
    }

    // 3. Email-based Rate Limiting (3 attempts per 15 minutes)
    const cleanEmail = email.toLowerCase().trim();
    const emailLimit = await checkRateLimit(`signup_email:${cleanEmail}`, 3, 15 * 60);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: { message: `Too many registration attempts for this email. Please retry in ${emailLimit.retryAfterSec} seconds.` } },
        { status: 429 }
      );
    }

    // 4. Enforce Password Security Policy
    const policyResult = validatePasswordPolicy(password);
    if (!policyResult.valid) {
      return NextResponse.json({ error: { message: policyResult.error } }, { status: 400 });
    }

    const existing = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return NextResponse.json({ error: { message: 'A user with this email address already exists.' } }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = generateId('usr');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const isDev = process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'production';

    const newUser = {
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      password_hash: passwordHash,
      is_super_admin: false,
      email_verified: isDev ? true : false, // In development auto-verify, in production require link
      verification_token: verificationToken,
      verification_token_expires_at: verificationExpires,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.users.push(newUser);

    const wsId = generateId('ws');
    const wsName = (workspace_name || workspaceName || `${name.trim()}'s Workspace`).trim();
    const newWorkspace = {
      id: wsId,
      name: wsName,
      slug: wsName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      plan: 'FREE' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.workspaces.push(newWorkspace);

    db.workspace_members.push({
      id: generateId('wsm'),
      workspace_id: wsId,
      user_id: userId,
      role: 'OWNER',
      created_at: new Date().toISOString()
    });

    // Auto-provision initial Commerce Agent for new workspace
    const agentId = generateId('agent');
    const newAgent = {
      id: agentId,
      workspace_id: wsId,
      name: 'ShopMate AI',
      description: 'Autonomous commerce concierge specialized in product discovery, live inventory queries, order status, and customer assistance.',
      industry: 'Omnichannel Retail & E-Commerce',
      primary_objective: 'Boost product conversions and handle order inquiries autonomously with verified tool executions.',
      language: 'English',
      status: 'PUBLISHED' as const,
      current_version_id: 'ver_shopmate_v1_0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.agents.push(newAgent);

    const templateConfig = db.agent_configs[0];
    if (templateConfig) {
      db.agent_configs.push({
        ...templateConfig,
        id: generateId('cfg'),
        agent_id: agentId,
        updated_at: new Date().toISOString()
      });
    }

    STANDARD_TOOLS.forEach(t => {
      db.tool_permissions.push({
        id: 'perm_' + agentId + '_' + t.id,
        agent_id: agentId,
        tool_id: t.id,
        is_enabled: true,
        permission_mode: t.risk_level === 'HIGH' ? 'REQUIRES_CONFIRMATION' : 'ALLOWED'
      });
    });

    db.saveImmediate();

    // Dispatch verification email asynchronously
    sendVerificationEmail(newUser.email, newUser.name, verificationToken).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    const token = await createSessionToken({
      userId: newUser.id,
      email: newUser.email,
      workspaceId: wsId
    });

    const response = NextResponse.json({
      success: true,
      user: { 
        id: newUser.id, 
        email: newUser.email, 
        name: newUser.name,
        email_verified: newUser.email_verified 
      },
      workspace_id: wsId,
      message: newUser.email_verified ? 'Account created.' : 'Verification email sent. Please verify your email.'
    });

    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https:');

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Signup failed' } }, { status: 500 });
  }
}
