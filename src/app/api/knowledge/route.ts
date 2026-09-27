import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { ingestDocument } from '@/lib/rag';

export async function GET(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const docs = db.knowledge_documents.filter(d => d.workspace_id === session.workspaceId);
  return NextResponse.json({ documents: docs, sources: docs });
}

export async function POST(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  try {
    const { name, type, content, agent_id } = await req.json();
    if (!name || !content) {
      return NextResponse.json({ error: { message: 'Document name and content are required' } }, { status: 400 });
    }

    const doc = await ingestDocument(session.workspaceId, {
      name,
      type: type || 'TEXT',
      rawContent: content,
      agentId: agent_id
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Ingestion failed' } }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN', 'EDITOR'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Insufficient permissions. Requires EDITOR, ADMIN, or OWNER role.' } }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: { message: 'Missing document ID' } }, { status: 400 });

  const docIdx = db.knowledge_documents.findIndex(d => d.id === id && d.workspace_id === session.workspaceId);
  if (docIdx >= 0) {
    db.knowledge_documents.splice(docIdx, 1);
    const chunkIndices = db.knowledge_chunks
      .map((c, i) => c.document_id === id ? i : -1)
      .filter(i => i !== -1)
      .reverse();
    chunkIndices.forEach(idx => db.knowledge_chunks.splice(idx, 1));

    db.saveImmediate();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: { message: 'Document not found' } }, { status: 404 });
}
