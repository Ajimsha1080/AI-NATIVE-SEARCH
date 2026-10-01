import { NextResponse } from 'next/server';
import { AIModeKnowledgeService } from '@/ai-mode/services/knowledge-service';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = AIModeKnowledgeService.deleteSource(id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}
