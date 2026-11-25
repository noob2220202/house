import { AGENCY_INVITE_CODE_ALPHABET, AGENCY_INVITE_CODE_LENGTH } from '@house/shared';

/**
 * 중개사무소 등록번호 / 사업자등록번호 helpers.
 *
 * 등록번호 has no single national format: current numbers look like "46150-2020-00012"
 * (시군구코드-연도-일련번호) but older offices still hold forms such as "가-1234-5678" or
 * "전남-순천-2015-0012". So the frontend only normalizes spacing and auto-hyphenates the purely
 * numeric modern form — the admin (and the registry lookup) is the authority.
 */
/** Format hint only — masked so it can never be a real office's number. */
export const REGISTRATION_NUMBER_EXAMPLE = '46150-0000-00000';

/** Characters a 등록번호 may contain: digits, Hangul, Latin letters, hyphen. */
const REGISTRATION_ALLOWED = /^[0-9A-Za-z가-힣-]+$/;

/** Trim, collapse whitespace/odd dashes, and hyphenate a 14-digit modern number. */
export function normalizeRegistrationNumber(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[‐‑‒–—―~]/g, '-')
    .replace(/\s+/g, '')
    .replace(/-{2,}/g, '-');
  if (/^\d{14}$/.test(cleaned)) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
  }
  return cleaned;
}

/** Loose validity check matching the backend (5–40 chars) plus a character allow-list. */
export function isPlausibleRegistrationNumber(input: string): boolean {
  const v = normalizeRegistrationNumber(input);
  return v.length >= 5 && v.length <= 40 && REGISTRATION_ALLOWED.test(v) && /\d{4,}/.test(v);
}

/** Digits of a 사업자등록번호 ("123-45-67890" → "1234567890"). */
export function businessNumberDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** "1234567890" → "123-45-67890" (partial input is formatted progressively while typing). */
export function formatBusinessNumber(input: string): string {
  const d = businessNumberDigits(input).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

const BUSINESS_NUMBER_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

/**
 * 사업자등록번호 check-digit validation (국세청 algorithm): Σ dᵢ·wᵢ + ⌊d₉·5 / 10⌋, then
 * (10 − sum mod 10) mod 10 must equal the last digit. Catches typos before the upload round trip.
 */
export function isValidBusinessNumber(input: string): boolean {
  const d = businessNumberDigits(input);
  if (!/^\d{10}$/.test(d)) return false;
  const digits = Array.from(d, Number);
  let sum = 0;
  BUSINESS_NUMBER_WEIGHTS.forEach((w, i) => {
    sum += (digits[i] ?? 0) * w;
  });
  sum += Math.floor(((digits[8] ?? 0) * 5) / 10);
  return (10 - (sum % 10)) % 10 === digits[9];
}

/**
 * Invite codes (shared `AGENCY_INVITE_CODE_*`): 10 characters of an unambiguous alphabet (no 0/O,
 * 1/I), shown as "ABCDE-FGHJK". The API normalizes the same way (`normalizeInviteCode`).
 */
export const INVITE_CODE_LENGTH = AGENCY_INVITE_CODE_LENGTH;
const HALF = Math.ceil(INVITE_CODE_LENGTH / 2);

/** Uppercase and strip separators: " abcde-fghjk " → "ABCDEFGHJK" (cut at the code length). */
export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, INVITE_CODE_LENGTH);
}

/** "ABCDEFGHJK" → "ABCDE-FGHJK" (also formats partial input while typing). */
export function formatInviteCode(input: string): string {
  const code = normalizeInviteCode(input);
  return code.length > HALF ? `${code.slice(0, HALF)}-${code.slice(HALF)}` : code;
}

/** Complete code made of the alphabet the server issues. */
export function isCompleteInviteCode(input: string): boolean {
  const code = normalizeInviteCode(input);
  return (
    code.length === INVITE_CODE_LENGTH &&
    [...code].every((ch) => AGENCY_INVITE_CODE_ALPHABET.includes(ch))
  );
}
