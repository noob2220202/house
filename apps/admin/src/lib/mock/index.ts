import { COOKIE_NAMES } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Mock-API helpers for route handlers under src/app/mock-api/v1/<resource>/**.
 * Every handler starts with `const off = mockGuard(); if (off) return off;` so the routes 404
 * unless NEXT_PUBLIC_API_MOCK=1. (Same helpers as apps/web/src/lib/mock, with admin sessions.)
 */
export const MOCK_ENABLED = process.env.NEXT_PUBLIC_API_MOCK === '1';

export function mockGuard(): NextResponse | null {
  return MOCK_ENABLED ? null : new NextResponse('Not Found', { status: 404 });
}

export function mockJson<T>(
  data: T,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { 'cache-control': 'no-store', ...init?.headers },
  });
}

/** Error in the backend's shape `{ code, message, details?, requestId }`. */
export function mockError(
  status: number,
  code: string,
  message: string,
  details?: { path?: string; code?: string; message: string }[],
): NextResponse {
  return NextResponse.json(
    { code, message, details, requestId: `mock-${Date.now().toString(36)}` },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export const mockNotFound = (code = 'NOT_FOUND', message = '요청하신 정보를 찾을 수 없습니다.') =>
  mockError(404, code, message);
export const mockUnauthenticated = () => mockError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
export const mockForbidden = () => mockError(403, 'FORBIDDEN', '접근 권한이 없습니다.');

/** Backend pagination envelope `{ items, page, pageSize, total, totalPages }` from `?page&pageSize`. */
export function mockPaginate<T>(
  all: readonly T[],
  req: NextRequest | URLSearchParams,
  defaults = { pageSize: 20 },
) {
  const sp = req instanceof URLSearchParams ? req : req.nextUrl.searchParams;
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || defaults.pageSize));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(sp.get('page')) || 1));
  return {
    items: all.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

/** Artificial latency so loading states are visible in dev; `?_delay=ms` overrides. */
export async function mockDelay(req?: NextRequest, ms = 150): Promise<void> {
  const override = req ? Number(req.nextUrl.searchParams.get('_delay')) : NaN;
  const wait = Number.isFinite(override) && override > 0 ? Math.min(override, 5000) : ms;
  await new Promise((resolve) => setTimeout(resolve, wait));
}

/** CSV query param → string[]. */
export function mockCsv(sp: URLSearchParams, key: string): string[] {
  return (sp.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- mock admin session (dev only) ---------------------------------------------------------------

export type MockAdminRole = 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';
const PREFIX = 'mock-';

export function mockAdminSessionValue(role: MockAdminRole): string {
  return `${PREFIX}${role}`;
}

/** Role of the mock admin session on this request, or null when signed out. */
export function mockAdminRole(req: NextRequest): MockAdminRole | null {
  const value = req.cookies.get(COOKIE_NAMES.ADMIN_SESSION)?.value;
  if (!value?.startsWith(PREFIX)) return null;
  const role = value.slice(PREFIX.length);
  return role === 'OPERATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN' ? role : null;
}

/** Guard for mock admin endpoints: returns a 401 response when there is no admin session. */
export function mockRequireAdmin(req: NextRequest): { role: MockAdminRole } | NextResponse {
  const role = mockAdminRole(req);
  return role ? { role } : mockUnauthenticated();
}

/** Mutating mock handlers call this to mimic the backend's CSRF check (header must equal the cookie). */
export function mockCsrfOk(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAMES.CSRF)?.value;
  return !!cookie && req.headers.get('x-csrf-token') === cookie;
}
