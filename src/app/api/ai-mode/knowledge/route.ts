import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { AiModeKnowledgeService } from '@/ai-mode/services/knowledge-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sources = AiModeKnowledgeService.getSources(session.workspaceId);
    return NextResponse.json({ success: true, sources });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.name || !body.type) {
      return NextResponse.json({ error: 'Missing name or type' }, { status: 400 });
    }

    const source = await AiModeKnowledgeService.addSource(session.workspaceId, {
      type: body.type,
      name: body.name,
      url: body.url,
      file_name: body.file_name,
      file_type: body.file_type,
      file_size: body.file_size,
      content_preview: body.content_preview,
      metadata: body.metadata
    });

    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
