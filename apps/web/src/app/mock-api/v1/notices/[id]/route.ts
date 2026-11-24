import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { sortedNotices } from '../_fixtures';

// GET /api/v1/notices/:id — one published notice. Public (admin module).
// `prev` / `next` (neighbours in list order) are ASSUMED extras; the page works without them.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const all = sortedNotices();
  const index = all.findIndex((n) => n.id === id);
  const found = all[index];
  if (!found) return mockNotFound('NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');
  const brief = (n: (typeof all)[number] | undefined) =>
    n ? { id: n.id, title: n.title, publishedAt: n.publishedAt } : null;
  // List order is newest first: the previous (older) notice is the next index.
  return mockJson({ ...found, prev: brief(all[index + 1]), next: brief(all[index - 1]) });
}
