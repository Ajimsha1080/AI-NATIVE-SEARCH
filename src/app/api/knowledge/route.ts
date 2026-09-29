import { NextResponse } from 'next/server';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { ingestDocument } from '@/lib/rag';
import { extractTextFromPdfBuffer } from '@/lib/utils/pdf-extractor';

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
    const contentType = req.headers.get('content-type') || '';
    let name = '';
    let type: any = 'TEXT';
    let content = '';
    let agent_id: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      name = (formData.get('name') as string) || file?.name || 'Uploaded Document';
      type = (formData.get('type') as string) || (name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCUMENT');
      agent_id = (formData.get('agent_id') as string) || undefined;

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (file.name.toLowerCase().endsWith('.pdf') || buffer.slice(0, 5).toString().startsWith('%PDF-')) {
          type = 'PDF';
          content = await extractTextFromPdfBuffer(buffer);
        } else {
          content = buffer.toString('utf-8');
        }
      } else {
        content = (formData.get('content') as string) || '';
      }
    } else {
      const body = await req.json();
      name = body.name;
      type = body.type || 'TEXT';
      content = body.content || '';
      agent_id = body.agent_id;

      // Handle base64 encoded PDF or raw PDF data string
      if (typeof content === 'string') {
        if (content.startsWith('data:application/pdf;base64,') || (body.isBase64 && type === 'PDF')) {
          const base64Data = content.replace(/^data:application\/pdf;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          content = await extractTextFromPdfBuffer(buffer);
          type = 'PDF';
        } else if (content.startsWith('%PDF-') || name?.toLowerCase().endsWith('.pdf')) {
          try {
            const buffer = Buffer.from(content, 'binary');
            const extracted = await extractTextFromPdfBuffer(buffer);
            if (extracted && extracted.length > 50) {
              content = extracted;
            }
          } catch {}
        }
      }
    }

    if (!name || !content || content.trim().length === 0) {
      return NextResponse.json({ error: { message: 'Document name and readable text content are required' } }, { status: 400 });
    }

    const doc = await ingestDocument(session.workspaceId, {
      name,
      type: type || 'TEXT',
      rawContent: content,
      agentId: agent_id
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (err: any) {
    console.error('Document ingestion error:', err);
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
  const isAll = url.searchParams.get('all') === 'true';
  if (isAll) {
    for (let i = db.knowledge_documents.length - 1; i >= 0; i--) {
      if (db.knowledge_documents[i].workspace_id === session.workspaceId) {
        db.knowledge_documents.splice(i, 1);
      }
    }
    for (let i = db.knowledge_chunks.length - 1; i >= 0; i--) {
      if (db.knowledge_chunks[i].workspace_id === session.workspaceId) {
        db.knowledge_chunks.splice(i, 1);
      }
    }
    db.saveImmediate();
    return NextResponse.json({ success: true, message: 'All knowledge documents removed' });
  }

  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: { message: 'Missing document ID' } }, { status: 400 });

  const docIdx = db.knowledge_documents.findIndex(d => d.id === id && d.workspace_id === session.workspaceId);
  if (docIdx >= 0) {
    db.knowledge_documents.splice(docIdx, 1);
    for (let i = db.knowledge_chunks.length - 1; i >= 0; i--) {
      if (db.knowledge_chunks[i].document_id === id && db.knowledge_chunks[i].workspace_id === session.workspaceId) {
        db.knowledge_chunks.splice(i, 1);
      }
    }

    db.saveImmediate();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: { message: 'Document not found' } }, { status: 404 });
}
