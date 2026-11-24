import {
  type adminPasswordChangeSchema,
  adminPasswordSchema,
  recoveryCodeSchema,
  totpCodeSchema,
} from '@house/shared';
import type { z } from 'zod';

/** Keeps only digits, at most `length` of them (paste "123 456" → "123456"). */
export function sanitizeOtp(input: string, length = 6): string {
  return input.replace(/\D/g, '').slice(0, length);
}

/** Base32 secret in groups of four for manual entry: "JBSW Y3DP EHPK 3PXP". */
export function groupSecret(secret: string): string {
  return (
    secret
      .replace(/\s+/g, '')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}

/** Account label inside an otpauth URI ("BRAND 관리자:me@example.com" → "me@example.com"). */
export function otpauthAccount(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') return null;
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, '').replace(/^totp\//, ''));
    const account = label.includes(':') ? label.slice(label.indexOf(':') + 1) : label;
    return account.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Admin password policy = shared `adminPasswordSchema` (12+ chars, letters + digits, max 128), the
 * schema the API validates POST /admin/auth/password with.
 */
export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_PASSWORD_MAX = 128;
export function passwordIssue(password: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN) return `${ADMIN_PASSWORD_MIN}자 이상 입력해 주세요.`;
  if (password.length > ADMIN_PASSWORD_MAX) return `${ADMIN_PASSWORD_MAX}자 이하로 입력해 주세요.`;
  const parsed = adminPasswordSchema.safeParse(password);
  if (!parsed.success) return '영문과 숫자를 모두 포함해 주세요.';
  return null;
}

export type AdminPasswordChangeInput = z.input<typeof adminPasswordChangeSchema>;

// ---------- second factor ----------

/** A second factor typed by the admin: the 6-digit TOTP code or a one-time recovery code. */
export type SecondFactor = { kind: 'code'; value: string } | { kind: 'recovery'; value: string };

/** "abcd efgh" / "ABCD-EFGH" → "ABCDEFGH" (the API normalizes the same way). */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Input mask of the recovery-code field: "ABCD-EFGH" while typing, at most 8 characters. */
export function formatRecoveryCode(input: string): string {
  const raw = normalizeRecoveryCode(input).slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/** Client-side check of a second factor, with the API's messages (shared schemas). */
export function secondFactorIssue(factor: SecondFactor): string | null {
  if (factor.kind === 'code')
    return totpCodeSchema.safeParse(factor.value).success
      ? null
      : '인증 코드 6자리를 입력해 주세요.';
  return recoveryCodeSchema.safeParse(factor.value).success
    ? null
    : '복구 코드 8자리를 입력해 주세요. (예: ABCD-EFGH)';
}

/** Body of POST /admin/auth/totp/verify: exactly one of `code` / `recoveryCode`. */
export function factorBody(factor: SecondFactor): { code: string } | { recoveryCode: string } {
  return factor.kind === 'code'
    ? { code: factor.value }
    : { recoveryCode: normalizeRecoveryCode(factor.value) };
}

/** Re-authentication for an authenticator re-enrolment (POST /admin/auth/totp/setup). */
export interface TotpReauth {
  currentPassword: string;
  factor: SecondFactor;
}

export function reauthBody(reauth: TotpReauth) {
  return { currentPassword: reauth.currentPassword, ...factorBody(reauth.factor) };
}
