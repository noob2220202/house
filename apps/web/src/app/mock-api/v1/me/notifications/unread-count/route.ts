import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { meGuard, mockForcedFailure } from '../../_store';
import { prepareFeed, scopeFilter, unreadOf } from '../_scope';

/** GET /api/v1/me/notifications/unread-count?scope → `{ unread }`. */
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 80);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  prepareFeed(g.role);
  return mockJson({ unread: unreadOf(g.state.notifications, scopeFilter(req)) });
}
