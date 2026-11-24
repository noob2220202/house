import { ADMIN_ROLE_RANK } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockForbidden,
  mockGuard,
  mockRequireAdmin,
  type MockAdminRole,
} from '@/lib/mock';

/** Mock admins per session role — same ids as the foundation's `admin/auth/_fixtures.ts`. */
export const MOCK_ACTORS: Record<MockAdminRole, { id: string; name: string; email: string }> = {
  SUPER_ADMIN: {
    id: '0a000000-0000-4000-8000-000000000001',
    name: '정다은',
    email: 'super@example.com',
  },
  ADMIN: { id: '0a000000-0000-4000-8000-000000000002', name: '한지우', email: 'admin@example.com' },
  OPERATOR: {
    id: '0a000000-0000-4000-8000-000000000003',
    name: '운영자',
    email: 'operator@example.com',
  },
};

export interface MockCtx {
  role: MockAdminRole;
  actor: { id: string; name: string; email: string };
  sp: URLSearchParams;
}

/**
 * Preamble shared by every m-content mock handler: 404 outside mock mode, 401 without a session,
 * 403 below `min`, CSRF check on mutations, artificial latency. `?_error=1` answers 500 so error
 * states can be exercised (`?_empty=1` is handled by the list handlers).
 */
export async function mockAdmin(
  req: NextRequest,
  opts: { min?: MockAdminRole; mutate?: boolean; delay?: number } = {},
): Promise<MockCtx | NextResponse> {
  const off = mockGuard();
  if (off) return off;
  const session = mockRequireAdmin(req);
  if (session instanceof Response) return session;
  if (opts.min && ADMIN_ROLE_RANK[session.role] < ADMIN_ROLE_RANK[opts.min]) return mockForbidden();
  if (opts.mutate && !mockCsrfOk(req))
    return mockError(403, 'CSRF_INVALID', '보안 토큰이 올바르지 않습니다.');
  await mockDelay(req, opts.delay ?? (opts.mutate ? 320 : 180));
  const sp = req.nextUrl.searchParams;
  if (sp.get('_error') === '1')
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  return { role: session.role, actor: MOCK_ACTORS[session.role], sp };
}

export const isResponse = (value: unknown): value is NextResponse => value instanceof Response;

/** Parses + validates a JSON body; a failure is answered like the backend (`VALIDATION_FAILED`). */
export async function mockBody<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S> | NextResponse> {
  const raw: unknown = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return mockError(
    400,
    'VALIDATION_FAILED',
    '입력값을 확인해 주세요.',
    parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  );
}

export const mockConflict = (code: string, message: string) => mockError(409, code, message);

/** Case-insensitive "contains" on any of the given fields. */
export function matchesText(q: string | null, ...fields: (string | null | undefined)[]): boolean {
  const needle = q?.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}
