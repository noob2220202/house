/** 관리자 계정 helpers (pure; unit tested). */

export type AdminAccountState = 'active' | 'pending' | 'locked' | 'disabled';

export interface AdminAccountLike {
  status: 'ACTIVE' | 'DISABLED';
  totpEnabled: boolean;
  /** Shared `AdminAccountView.locked`. */
  locked?: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
}

/**
 * 사용 중지 > 잠김 (too many failed logins: `locked`, or until `lockedUntil`) > 첫 로그인 전
 * (never signed in, no authenticator yet) > 사용 중.
 */
export function adminAccountState(a: AdminAccountLike, now: Date = new Date()): AdminAccountState {
  if (a.status === 'DISABLED') return 'disabled';
  if (a.locked) return 'locked';
  if (a.lockedUntil && new Date(a.lockedUntil).getTime() > now.getTime()) return 'locked';
  if (!a.lastLoginAt && !a.totpEnabled) return 'pending';
  return 'active';
}

export const ADMIN_STATE_LABEL: Record<AdminAccountState, string> = {
  active: '사용 중',
  pending: '첫 로그인 전',
  locked: '잠김',
  disabled: '사용 중지',
};
export const ADMIN_STATE_TONE = {
  active: 'live',
  pending: 'scheduled',
  locked: 'review',
  disabled: 'ended',
} as const;

/** Textarea → list of IPs / CIDRs: one per line (commas and spaces also split), de-duplicated. */
export function parseIpAllowlist(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,]+/)) {
    const value = part.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out;
}

/**
 * True when `ip` is allowed by the list (exact IPv4 or CIDR). An empty list allows everything.
 * Used to warn before an admin saves an allowlist that would shut out their own address.
 */
export function ipAllowedBy(ip: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return true;
  const value = ipv4ToInt(ip);
  if (value === null) return true; // IPv6 / unknown: nothing to compare against
  return allowlist.some((entry) => {
    const [base = '', bits] = entry.split('/');
    const start = ipv4ToInt(base);
    if (start === null) return false;
    const prefix = bits === undefined ? 32 : Number(bits);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const size = 2 ** (32 - prefix);
    return Math.floor(value / size) === Math.floor(start / size);
  });
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '!@#$%^&*-_=+';

/**
 * Temporary password that satisfies the admin password policy (12+ chars with letters, digits and
 * symbols). Look-alike characters (l/1, O/0) are left out because it is passed on by hand.
 * `random(n)` must return a uniform integer in [0, n) — the default uses the Web Crypto API.
 */
export function generateTempPassword(
  length = 16,
  random: (n: number) => number = cryptoRandom,
): string {
  const size = Math.max(12, length);
  const pick = (chars: string) => chars[random(chars.length)] ?? chars[0]!;
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  const out = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (out.length < size) out.push(pick(all));
  // Fisher–Yates so the guaranteed classes are not always in front.
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.join('');
}

function cryptoRandom(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const value = buf[0] ?? 0;
    if (value < limit) return value % n;
  }
}
