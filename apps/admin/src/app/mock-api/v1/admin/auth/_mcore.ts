import { createHmac, randomBytes } from 'node:crypto';
import { COOKIE_NAMES } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { BRAND } from '@/config/brand';
import { mockAdminRole, mockAdminSessionValue, mockCsrfOk, type MockAdminRole } from '@/lib/mock';
import { MOCK_ADMINS } from './_fixtures';

/**
 * MOCK ONLY helpers for the m-core login flow (email + password → TOTP).
 * Fictional test accounts for local development; nothing here exists outside mock mode.
 */
export const MOCK_PASSWORD = 'mock-admin-2026';
/** Always-accepted code in mock mode (a real authenticator code for MOCK_TOTP_SECRET works too). */
export const MOCK_TOTP_CODE = '123456';
/** Well-known RFC example secret — safe to show, never used by a real account. */
export const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

export interface MockAccount {
  email: string;
  role: MockAdminRole;
  /** False → the login flow goes through authenticator enrolment (QR) first. */
  totpEnrolled: boolean;
  locked?: boolean;
}

export const MOCK_ACCOUNTS: readonly MockAccount[] = [
  { email: 'super@example.com', role: 'SUPER_ADMIN', totpEnrolled: true },
  { email: 'admin@example.com', role: 'ADMIN', totpEnrolled: true },
  { email: 'operator@example.com', role: 'OPERATOR', totpEnrolled: true },
  { email: 'new@example.com', role: 'OPERATOR', totpEnrolled: false },
  { email: 'locked@example.com', role: 'OPERATOR', totpEnrolled: true, locked: true },
];

// ---- half-authenticated session (password ok, TOTP pending) ----

const PENDING_PREFIX = 'mock-pending.';

export interface MockPending {
  account: MockAccount;
}

export function mockPendingValue(account: MockAccount): string {
  return `${PENDING_PREFIX}${MOCK_ACCOUNTS.indexOf(account)}`;
}

export function mockPending(req: NextRequest): MockPending | null {
  const value = req.cookies.get(COOKIE_NAMES.ADMIN_SESSION)?.value;
  if (!value?.startsWith(PENDING_PREFIX)) return null;
  const account = MOCK_ACCOUNTS[Number(value.slice(PENDING_PREFIX.length))];
  return account ? { account } : null;
}

export function setAdminCookie(res: NextResponse, value: string): void {
  res.cookies.set(COOKIE_NAMES.ADMIN_SESSION, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
}

export function fullSessionValue(role: MockAdminRole): string {
  return mockAdminSessionValue(role);
}

/** True when the request carries an admin session of either kind (pre-MFA or verified). */
export function mockHasAdminSession(req: NextRequest): boolean {
  return !!mockPending(req) || !!mockAdminRole(req);
}

/**
 * Like the API's CsrfGuard: a mutation is only CSRF-checked when it carries a session (the login
 * itself, without one, is not). The mock compares the header with the readable cookie it issued.
 */
export function mockCsrfRequired(req: NextRequest): boolean {
  return mockHasAdminSession(req) && !mockCsrfOk(req);
}

/** A fresh CSRF token (the API issues one per session). */
export function newCsrfToken(): string {
  return `mock-csrf-${randomBytes(9).toString('base64url')}`;
}

/** Sets the readable CSRF cookie, like the API's `SessionService.setCsrfCookie`. */
export function setCsrfCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAMES.CSRF, token, { path: '/', sameSite: 'lax', httpOnly: false });
}

// ---- pending TOTP enrolment (POST /totp/setup → POST /totp/activate) ----

const SETUP_COOKIE = 'mock_admin_totp_setup';
/** The API keeps a pending secret for 10 minutes (TOTP_SETUP_TTL_SECONDS). */
export const MOCK_SETUP_TTL_SECONDS = 600;

export function markSetupPending(res: NextResponse): void {
  res.cookies.set(SETUP_COOKIE, '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MOCK_SETUP_TTL_SECONDS,
  });
}

export function hasPendingSetup(req: NextRequest): boolean {
  return req.cookies.get(SETUP_COOKIE)?.value === '1';
}

export function clearPendingSetup(res: NextResponse): void {
  res.cookies.delete(SETUP_COOKIE);
}

/** Recovery codes the mock still accepts: any of MOCK_RECOVERY_CODES (normalized like the API). */
export function mockRecoveryValid(recoveryCode: string): boolean {
  return MOCK_RECOVERY_CODES.some((c) => c.replace(/[^0-9A-Z]/g, '') === recoveryCode);
}

/** Shared `AdminMeResponse` of the mock admin with this role. */
export function mockAdminMe(role: MockAdminRole): Record<string, unknown> {
  return { ...MOCK_ADMINS[role] };
}

/** E-mail of whoever is on this request: a pending login or a fully signed-in mock admin. */
export function mockActorEmail(req: NextRequest): string | null {
  const pending = mockPending(req);
  if (pending) return pending.account.email;
  const role = mockAdminRole(req);
  return role ? String(MOCK_ADMINS[role].email) : null;
}

// ---- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) ----

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpAt(secret: string, timeMs: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30_000)));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

export function mockTotpValid(code: string, now = Date.now()): boolean {
  if (code === MOCK_TOTP_CODE) return true;
  return [-1, 0, 1].some((step) => totpAt(MOCK_TOTP_SECRET, now + step * 30_000) === code);
}

export function mockOtpauthUrl(email: string): string {
  const issuer = `${BRAND.name} ${BRAND.consoleLabel}`;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${MOCK_TOTP_SECRET}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten codes, like the API (RECOVERY_CODE_COUNT). */
export const MOCK_RECOVERY_CODES = [
  'SC7K-2M9Q',
  'H4TN-8WXP',
  'R6DV-3JYA',
  'B9LF-5CZE',
  'M2QG-7KUH',
  'X8PW-4NSD',
  'T3YB-6RVJ',
  'E5AC-9HML',
  'K7RZ-2DFW',
  'P4GU-8BNQ',
] as const;

export const CSRF_FAIL = [
  403,
  'CSRF_FAILED',
  '보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
] as const;
