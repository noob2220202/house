import { COOKIE_NAMES } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Mock-API helpers for route handlers under src/app/mock-api/v1/<resource>/**.
 * Every handler starts with `const off = mockGuard(); if (off) return off;` so the routes 404
 * unless NEXT_PUBLIC_API_MOCK=1.
 */
export const MOCK_ENABLED = process.env.NEXT_PUBLIC_API_MOCK === '1';

/** Returns a 404 response when mock mode is off (and always in production builds without the flag). */
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

/** Artificial latency so loading states are visible in dev: `await mockDelay()`; `?_delay=ms` overrides. */
export async function mockDelay(req?: NextRequest, ms = 150): Promise<void> {
  const override = req ? Number(req.nextUrl.searchParams.get('_delay')) : NaN;
  const wait = Number.isFinite(override) && override > 0 ? Math.min(override, 5000) : ms;
  await new Promise((resolve) => setTimeout(resolve, wait));
}

/** CSV query param → string[] (the backend accepts arrays as CSV). */
export function mockCsv(sp: URLSearchParams, key: string): string[] {
  return (sp.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Deterministic fake UUID from a short fixture id ("L01" → "00000000-0000-4000-8000-00000000l01…"). */
export function mockUuid(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
}

// ---- mock session (dev only) -------------------------------------------------------------------

export type MockRole = 'USER' | 'AGENT' | 'AGENCY_OWNER';
const MOCK_SESSION_PREFIX = 'mock-';

/** Value stored in the session cookie in mock mode: "mock-USER" | "mock-AGENT" | "mock-AGENCY_OWNER". */
export function mockSessionValue(role: MockRole): string {
  return `${MOCK_SESSION_PREFIX}${role}`;
}

/** Role of the mock session on this request, or null when signed out. */
export function mockSessionRole(req: NextRequest): MockRole | null {
  const value = req.cookies.get(COOKIE_NAMES.SESSION)?.value;
  if (!value?.startsWith(MOCK_SESSION_PREFIX)) return null;
  const role = value.slice(MOCK_SESSION_PREFIX.length);
  return role === 'USER' || role === 'AGENT' || role === 'AGENCY_OWNER' ? role : null;
}

/** Mutating mock handlers call this to mimic the backend's CSRF check (header must equal the cookie). */
export function mockCsrfOk(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAMES.CSRF)?.value;
  return !!cookie && req.headers.get('x-csrf-token') === cookie;
}
