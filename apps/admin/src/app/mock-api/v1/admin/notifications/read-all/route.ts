import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockRequireAdmin,
} from '@/lib/mock';
import { mockCoreState } from '../../dashboard/_store';

/** POST /api/v1/admin/notifications/read-all — ASSUMED endpoint. */
export async function POST(req: NextRequest) {
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
  await mockDelay(req, 200);
  const state = mockCoreState();
  let updated = 0;
  for (const n of state.notifications) {
    if (!n.read) {
      n.read = true;
      updated += 1;
    }
  }
  return mockJson({ updated, unreadCount: 0 });
}
