import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockRequireAdmin } from '@/lib/mock';
import { TIME, ago, mockCoreState } from '../dashboard/_store';

/**
 * GET /api/v1/admin/notifications?cursor&limit&unreadOnly — ASSUMED endpoint.
 * Cursor feed (`CursorPage`) of back-office notifications, newest first, plus `unreadCount`.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  await mockDelay(req, 250);
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 20));
  const unreadOnly = sp.get('unreadOnly') === 'true' || sp.get('unreadOnly') === '1';
  const state = mockCoreState();
  const all = state.notifications.filter((n) => !unreadOnly || !n.read);
  const start = Math.max(0, Number(sp.get('cursor')) || 0);
  const now = Date.now();
  const items = all.slice(start, start + limit).map(({ minutesAgo, read, ...n }) => ({
    ...n,
    createdAt: ago(minutesAgo * TIME.MIN, now),
    readAt: read ? ago(Math.max(0, minutesAgo - 5) * TIME.MIN, now) : null,
  }));
  return mockJson({
    items,
    nextCursor: start + limit < all.length ? String(start + limit) : null,
    unreadCount: state.notifications.filter((n) => !n.read).length,
  });
}
