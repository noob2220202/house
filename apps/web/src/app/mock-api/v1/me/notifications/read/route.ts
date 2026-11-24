import { notificationReadSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { meGuard } from '../../_store';
import { prepareFeed, scopeFilter, unreadOf } from '../_scope';

/**
 * POST /api/v1/me/notifications/read?scope — body `{ ids }` or `{ all: true }`
 * (`notificationReadSchema`) → `{ updated, unread }`. With `scope`, "all" covers that audience
 * only and `unread` is the scope's count.
 */
export async function POST(req: NextRequest) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const parsed = notificationReadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(400, 'VALIDATION_FAILED', '읽음 처리할 알림을 선택해 주세요.', [
      { path: 'ids', code: 'invalid', message: 'ids 또는 all 중 하나만 지정해 주세요.' },
    ]);
  prepareFeed(g.role);
  const inScope = scopeFilter(req);
  const ids = parsed.data.ids ?? [];
  const now = new Date().toISOString();
  let updated = 0;
  for (const n of g.state.notifications) {
    const hit = parsed.data.all ? inScope(n) : ids.includes(n.id);
    if (!n.readAt && hit) {
      n.readAt = now;
      updated += 1;
    }
  }
  return mockJson({ updated, unread: unreadOf(g.state.notifications, inScope) });
}
