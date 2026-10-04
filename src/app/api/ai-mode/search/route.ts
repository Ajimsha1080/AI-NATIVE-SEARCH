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

    const wsId = session?.workspaceId || 'ws_acme_corp';
    const pythonUrl = process.env.PYTHON_BACKEND_URL;

    if (pythonUrl) {
      try {
        const pyRes = await fetch(`${pythonUrl}/api/v1/ai-mode/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query || '',
            workspace_id: wsId,
            page: page || 1,
            page_size: page_size || 48
          }),
          signal: AbortSignal.timeout(3000)
        });

        if (pyRes.ok) {
          const pyData = await pyRes.json();
          return NextResponse.json({ success: true, ...pyData, backend: 'python-fastapi' });
        }
      } catch (pyErr) {
        console.warn('Python AI Mode backend unavailable, using native engine fallback:', pyErr);
      }
    }

    const plan = AIModeSearchService.parseQuery(query || '');
    if (filters) {
      plan.extracted_filters = { ...plan.extracted_filters, ...filters };
    }
    if (sort) plan.sort = sort;
    if (page) plan.pagination.page = page;
    if (page_size) plan.pagination.page_size = page_size;

    const results = await AIModeSearchService.search(plan, wsId);
    return NextResponse.json({ success: true, ...results, backend: 'native-typescript' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search execution failed' }, { status: 500 });
  }
}
