import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { meGuard, mockForcedFailure } from '../_store';

// GET /api/v1/me/notifications?cursor&limit&unreadOnly — cursor feed, newest first.
// Response: CursorPage<Notification> + unreadCount. The cursor is opaque (here: the next offset).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 20));
  const offset = Math.max(0, Number(sp.get('cursor')) || 0);
  const unreadOnly = sp.get('unreadOnly') === 'true' || sp.get('unreadOnly') === '1';
  const all = g.state.notifications;
  const rows = unreadOnly ? all.filter((n) => !n.readAt) : all;
  const items = rows.slice(offset, offset + limit);
  const next = offset + limit;
  return mockJson({
    items,
    nextCursor: next < rows.length ? String(next) : null,
    unreadCount: all.filter((n) => !n.readAt).length,
  });
}
