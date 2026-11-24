import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { sortedNotices } from './_fixtures';

// GET /api/v1/notices?page&pageSize — published notices, pinned first then newest. Public (admin module).
// `?q=` (title search) is an ASSUMED extra. `?_empty=1` returns an empty page (dev: empty state).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  const all = sp.has('_empty')
    ? []
    : sortedNotices()
        .filter((n) => q === '' || n.title.toLowerCase().includes(q))
        .map(({ content: _content, ...summary }) => summary);
  return mockJson(mockPaginate(all, req, { pageSize: 10 }));
}
