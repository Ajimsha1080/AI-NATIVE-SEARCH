import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { AiModeKnowledgeService } from '@/ai-mode/services/knowledge-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Missing source id' }, { status: 400 });
    }

    const updated = await AiModeKnowledgeService.syncSource(body.id, session.workspaceId);
    if (!updated) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, source: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
