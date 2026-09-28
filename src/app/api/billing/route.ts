import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getWorkspaceUsage, PLAN_LIMITS } from '@/lib/billing/limits';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const workspace = db.workspaces.find(w => w.id === session.workspaceId);
  const usageData = getWorkspaceUsage(session.workspaceId);

  const invoices: any[] = [];

  return NextResponse.json({
    plan: usageData.plan,
    subscription_status: workspace?.subscription_status || 'active',
    has_stripe_customer: Boolean(workspace?.stripe_customer_id),
    billing_cycle: 'Monthly (Auto-Renews on 1st of every month)',
    next_billing_date: new Date(Date.now() + 28 * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    usage: usageData.usage,
    available_plans: Object.keys(PLAN_LIMITS),
    invoices
  });
}

export async function PATCH(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  try {
    const body = await req.json();
    const { plan } = body;
    if (!plan || !PLAN_LIMITS[plan.toUpperCase()]) {
      return NextResponse.json({ error: { message: 'Invalid plan selected' } }, { status: 400 });
    }

    const cleanPlan = plan.toUpperCase();
    const ws = db.workspaces.find(w => w.id === session.workspaceId);
    if (ws) {
      ws.plan = cleanPlan as any;
      ws.updated_at = new Date().toISOString();
      db.scheduleSave();
    }

    const usageData = getWorkspaceUsage(session.workspaceId);
    return NextResponse.json({
      success: true,
      message: `Workspace successfully updated to ${cleanPlan} plan.`,
      plan: cleanPlan,
      usage: usageData.usage
    });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Plan update failed' } }, { status: 500 });
  }
}
