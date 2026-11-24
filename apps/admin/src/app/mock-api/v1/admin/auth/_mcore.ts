import { createHmac } from 'node:crypto';
import { COOKIE_NAMES } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { BRAND } from '@/config/brand';
import { mockAdminRole, mockAdminSessionValue, type MockAdminRole } from '@/lib/mock';
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

export const MOCK_RECOVERY_CODES = [
  'SC7K-2M9Q',
  'H4TN-8WXP',
  'R6DV-3JYA',
  'B9LF-5CZE',
  'M2QG-7KUH',
  'X8PW-4NSD',
  'T3YB-6RVJ',
  'E5AC-9HML',
] as const;

export const CSRF_FAIL = [
  403,
  'CSRF_TOKEN_INVALID',
  '보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
] as const;
