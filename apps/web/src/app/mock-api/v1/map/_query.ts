import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { mockError } from '@/lib/mock';

/** Query entries without the mock-only `_delay` / `_fail` switches. */
export function queryObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries([...req.nextUrl.searchParams].filter(([k]) => !k.startsWith('_')));
}

/** 400 in the backend's validation shape (`VALIDATION_FAILED` + `details[].path`). */
export function validationError(error: z.ZodError) {
  return mockError(
    400,
    'VALIDATION_FAILED',
    '요청 값이 올바르지 않습니다.',
    error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

/** `?_fail=1` makes a map mock answer 500 — for checking error states by hand. */
export function forcedFailure(req: NextRequest) {
  return req.nextUrl.searchParams.get('_fail') === '1'
    ? mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.')
    : null;
}
