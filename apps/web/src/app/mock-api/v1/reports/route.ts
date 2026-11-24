import { reportCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockSessionRole,
  mockUnauthenticated,
  mockUuid,
} from '@/lib/mock';

// POST /api/v1/reports — 허위매물 신고 (admin module; login required, throttled with a daily cap).
// Body = `reportCreateSchema` (@house/shared). → 201 { id, status: 'RECEIVED', createdAt }
// Mock switches: detail containing "__limit" → 429 REPORT_DAILY_LIMIT (to exercise the error state).
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 400);
  if (!mockSessionRole(req)) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(403, 'CSRF_FAILED', '보안 토큰이 올바르지 않습니다.');
  const body: unknown = await req.json().catch(() => null);
  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  if (parsed.data.detail?.includes('__limit')) {
    return mockError(
      429,
      'REPORT_DAILY_LIMIT',
      '오늘 신고할 수 있는 횟수를 넘었습니다. 내일 다시 시도해 주세요.',
    );
  }
  return mockJson(
    {
      id: mockUuid(`report-${parsed.data.targetId}-${Date.now()}`),
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      status: 'RECEIVED',
      createdAt: new Date().toISOString(),
    },
    { status: 201 },
  );
}
