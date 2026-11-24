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

/** Password policy of admin accounts (assumed): ≥ 10 chars with a letter and a digit. */
export const ADMIN_PASSWORD_MIN = 10;
export function passwordIssue(password: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN) return `${ADMIN_PASSWORD_MIN}자 이상 입력해 주세요.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return '영문과 숫자를 모두 포함해 주세요.';
  return null;
}
