import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockError,
  mockGuard,
  mockJson,
  mockNotFound,
  mockRequireAdmin,
} from '@/lib/mock';
import { mockCoreState } from '../../../dashboard/_store';

/** POST /api/v1/admin/notifications/:id/read — ASSUMED endpoint. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  if (!mockCsrfOk(req))
    return mockError(
      403,
      'CSRF_TOKEN_INVALID',
      '보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
    );
  const { id } = await ctx.params;
  const state = mockCoreState();
  const item = state.notifications.find((n) => n.id === id);
  if (!item) return mockNotFound('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다.');
  item.read = true;
  return mockJson({ id, unreadCount: state.notifications.filter((n) => !n.read).length });
}
