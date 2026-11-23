// Owned by the agencies module team. Pure domain rules shared by api and frontends.
import { AgencyStatus, type AgencyStatus as AgencyStatusValue } from '../enums/agency';

/**
 * Admin decisions. REJECTED → PENDING happens only by the owner resubmitting
 * (POST /agencies/mine/resubmit), never by an admin decision.
 */
const ADMIN_TRANSITIONS: Record<AgencyStatusValue, readonly AgencyStatusValue[]> = {
  PENDING: [AgencyStatus.APPROVED, AgencyStatus.REJECTED],
  APPROVED: [AgencyStatus.SUSPENDED],
  SUSPENDED: [AgencyStatus.APPROVED],
  REJECTED: [],
};

export function canAdminTransitionAgency(from: AgencyStatusValue, to: AgencyStatusValue): boolean {
  return ADMIN_TRANSITIONS[from].includes(to);
}

/** Agency statuses whose members act for the agency (a session's agencyId may point at them). */
export const LIVE_AGENCY_STATUSES: readonly AgencyStatusValue[] = [
  AgencyStatus.PENDING,
  AgencyStatus.APPROVED,
  AgencyStatus.SUSPENDED,
];

/**
 * 중개사무소 등록번호 normalization: drops whitespace and the "제 … 호" wrapper printed on the
 * certificate ("제46150-2020-00012호" → "46150-2020-00012"). Uniqueness is checked on this form.
 */
export function normalizeRegistrationNumber(input: string): string {
  return input
    .replace(/\s+/g, '')
    .replace(/^제/, '')
    .replace(/호$/, '')
    .replace(/[‐-―−]/g, '-');
}

/** 등록번호 characters: digits, ASCII letters, 한글 (older formats like "가1234-5678"), hyphens. */
export const REGISTRATION_NUMBER_PATTERN =
  /^[0-9A-Za-z가-힣](?:[0-9A-Za-z가-힣-]{2,38})[0-9A-Za-z가-힣]$/;

/** 사업자등록번호 (10 digits) check-digit validation. */
export function isValidBusinessNumber(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  const d = digits.split('').map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (d[i] as number) * (weights[i] as number);
  sum += Math.floor(((d[8] as number) * 5) / 10);
  return (10 - (sum % 10)) % 10 === d[9];
}

/** 1234567890 → 123-45-67890 */
export function formatBusinessNumber(digits: string): string {
  return /^\d{10}$/.test(digits)
    ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
    : digits;
}

/** Invite codes: 10 chars of an unambiguous alphabet (no 0/O/1/I), shown as XXXXX-XXXXX. */
export const AGENCY_INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const AGENCY_INVITE_CODE_LENGTH = 10;

export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function formatInviteCode(code: string): string {
  return code.length === AGENCY_INVITE_CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}
