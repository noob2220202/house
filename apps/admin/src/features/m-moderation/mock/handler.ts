import type { NextRequest, NextResponse } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockRequireAdmin,
  type MockAdminRole,
} from '@/lib/mock';

/**
 * Shared preamble of the moderation mock handlers (dev only — every route 404s unless
 * NEXT_PUBLIC_API_MOCK=1): mock guard → admin session → CSRF (mutations) → artificial latency.
 * Returns a response to short-circuit with, or the admin's role.
 */
export async function modGate(
  req: NextRequest,
  options: { mutation?: boolean } = {},
): Promise<NextResponse | { role: MockAdminRole }> {
  const off = mockGuard();
  if (off) return off;
  const admin = mockRequireAdmin(req);
  if (!('role' in admin)) return admin;
  if (options.mutation && !mockCsrfOk(req))
    return mockError(403, 'CSRF_TOKEN_INVALID', '보안 토큰이 만료되었습니다. 다시 시도해 주세요.');
  await mockDelay(req, options.mutation ? 350 : 180);
  return admin;
}

export function isBlocked(gate: NextResponse | { role: MockAdminRole }): gate is NextResponse {
  return !('role' in gate);
}

/** Display name of the acting mock admin (matches admin/auth/_fixtures.ts). */
export const MOCK_ADMIN_NAME: Record<MockAdminRole, string> = {
  SUPER_ADMIN: '정다은',
  ADMIN: '한지우',
  OPERATOR: '운영자',
};

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A trimmed string field of a JSON body ('' when missing or not a string). */
export function readText(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function validationError(path: string, message: string) {
  return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ path, message }]);
}

/** Case-insensitive "contains" over several optional fields. */
export function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase().replace(/[\s-]/g, '');
  if (!needle) return true;
  return fields.some((f) => !!f && f.toLowerCase().replace(/[\s-]/g, '').includes(needle));
}

// ---------- time & ids ----------------------------------------------------------------------

const MIN = 60_000;
/** ISO timestamp `d` days, `h` hours, `m` minutes before now — keeps "40분 전" style data fresh. */
export function ago({ d = 0, h = 0, m = 0 }: { d?: number; h?: number; m?: number }): string {
  return new Date(Date.now() - ((d * 24 + h) * 60 + m) * MIN).toISOString();
}
export function nowIso(): string {
  return new Date().toISOString();
}
/** YYYY-MM-DD `d` days from today. */
export function dateFromNow(d: number): string {
  return new Date(Date.now() + d * 24 * 60 * MIN).toISOString().slice(0, 10);
}

/** Deterministic fixture UUID: `mid('0b', 7)` → 0b000000-0000-4000-8000-000000000007. */
export function mid(prefix: string, n: number): string {
  return `${prefix.padEnd(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
let seq = 0;
/** Fresh id for rows created by mock mutations. */
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix.padEnd(8, '0')}-0000-4000-9000-${(Date.now() % 1e9).toString().padStart(9, '0')}${String(seq % 1000).padStart(3, '0')}`;
}

/** In-memory table kept on globalThis so every route module (and HMR reload) shares one copy. */
export function mockTable<T>(key: string, seed: () => T[]): T[] {
  const g = globalThis as typeof globalThis & { __modMock?: Record<string, unknown[]> };
  g.__modMock ??= {};
  g.__modMock[key] ??= seed();
  return g.__modMock[key] as T[];
}
