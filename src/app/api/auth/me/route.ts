import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { seedDatabaseIfEmpty } from '@/lib/db/seed';

export async function GET(req: Request) {
  if (db.users.length === 0 || db.commerce_products.length === 0) {
    await seedDatabaseIfEmpty();
  }
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const workspace = db.workspaces.find(w => w.id === session.workspaceId);
  const allWorkspaces = db.workspace_members
    .filter(m => m.user_id === session.user.id)
    .map(m => {
      const ws = db.workspaces.find(w => w.id === m.workspace_id);
      return ws ? { ...ws, role: m.role } : null;
    })
    .filter(Boolean);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatar_url: session.user.avatar_url,
      is_super_admin: session.user.is_super_admin
    },
    workspace,
    role: session.role,
    workspaces: allWorkspaces.length > 0 ? allWorkspaces : [workspace]
  });
}
