import { NextResponse } from 'next/server';
import { AIModeSearchService } from '@/ai-mode/services/ai-search-service';
import { getAuthSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    const body = await req.json().catch(() => ({}));
    const { query, filters, sort, page, page_size } = body;

    if (!query && !filters) {
      return NextResponse.json({ error: 'Query or filters are required' }, { status: 400 });
    }

    const plan = AIModeSearchService.parseQuery(query || '');
    if (filters) {
      plan.extracted_filters = { ...plan.extracted_filters, ...filters };
    }
    if (sort) plan.sort = sort;
    if (page) plan.pagination.page = page;
    if (page_size) plan.pagination.page_size = page_size;

    const results = await AIModeSearchService.search(plan, session?.workspaceId);
    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search execution failed' }, { status: 500 });
  }
}
