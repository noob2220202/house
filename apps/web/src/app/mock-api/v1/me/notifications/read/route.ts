import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { meGuard } from '../../_store';

// POST /api/v1/me/notifications/read — body { ids: string[] } or { all: true }.
export async function POST(req: NextRequest) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string')
    : [];
  const all = body?.all === true;
  if (!all && ids.length === 0)
    return mockError(400, 'VALIDATION_FAILED', '읽음 처리할 알림을 선택해 주세요.', [
      { path: 'ids', code: 'too_small', message: '알림 ID가 필요합니다.' },
    ]);
  const now = new Date().toISOString();
  let updated = 0;
  for (const n of g.state.notifications) {
    if (!n.readAt && (all || ids.includes(n.id))) {
      n.readAt = now;
      updated += 1;
    }
  }
  return mockJson({
    updated,
    unreadCount: g.state.notifications.filter((n) => !n.readAt).length,
  });
}
