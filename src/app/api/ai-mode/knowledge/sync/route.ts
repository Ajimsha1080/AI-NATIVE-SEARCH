import { NextResponse } from 'next/server';
import { AIModeKnowledgeService } from '@/ai-mode/services/knowledge-service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const updated = await AIModeKnowledgeService.syncSource(id);
    return NextResponse.json({ success: true, source: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}
