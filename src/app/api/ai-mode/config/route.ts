import { NextResponse } from 'next/server';
import { aiModeStorage } from '@/ai-mode/services/storage';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    const wsId = session?.workspaceId || 'ws_acme_corp';
    const config = aiModeStorage.getConfig(wsId);
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession(req);
    const wsId = session?.workspaceId || 'ws_acme_corp';
    const body = await req.json().catch(() => ({}));
    const updated = aiModeStorage.updateConfig(wsId, body);
    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update config' }, { status: 500 });
  }
}
