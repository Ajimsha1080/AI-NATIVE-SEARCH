import { NextResponse } from 'next/server';
import { AIModeKnowledgeService } from '@/ai-mode/services/knowledge-service';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    const wsId = session?.workspaceId || 'ws_acme_corp';
    const sources = AIModeKnowledgeService.getSources(wsId);
    return NextResponse.json({ success: true, sources });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch knowledge' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    const wsId = session?.workspaceId || 'ws_acme_corp';
    const body = await req.json().catch(() => ({}));
    const { type, url, name, content } = body;

    if (type === 'WEBSITE') {
      if (!url) return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
      const source = await AIModeKnowledgeService.addWebsiteSource({ workspaceId: wsId, url, name });
      return NextResponse.json({ success: true, source });
    }

    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    const source = AIModeKnowledgeService.addDocumentSource({
      workspaceId: wsId,
      name,
      content,
      type: type || 'DOCUMENT'
    });

    return NextResponse.json({ success: true, source });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save knowledge' }, { status: 500 });
  }
}
