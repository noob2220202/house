import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockRequireAdmin,
} from '@/lib/mock';
import { CSRF_FAIL, MOCK_PASSWORD } from '../_mcore';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
});

/**
 * POST /api/v1/admin/auth/password { currentPassword, newPassword } — ASSUMED endpoint.
 * The mock validates the current password but does not store the new one.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 350);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력 내용을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message:
          i.path[0] === 'newPassword'
            ? '새 비밀번호는 10자 이상이어야 합니다.'
            : '필수 항목입니다.',
      })),
    );
  if (parsed.data.currentPassword !== MOCK_PASSWORD)
    return mockError(400, 'AUTH_INVALID_CREDENTIALS', '현재 비밀번호가 올바르지 않습니다.', [
      {
        path: 'currentPassword',
        code: 'AUTH_INVALID_CREDENTIALS',
        message: '현재 비밀번호가 올바르지 않습니다.',
      },
    ]);
  return mockJson({ ok: true });
}
