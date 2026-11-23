/**
 * Phone numbers are plain contact fields: format-validated and normalized, never verified
 * (the platform sends no SMS). Canonical storage form is national digits only: "01012345678".
 * Use toE164Kr() when an international (E.164) form is needed.
 */

/** Korean mobile numbers: 010/011/016/017/018/019 + 7~8 digits. */
export const KR_MOBILE_PATTERN = /^01[016789]\d{7,8}$/;

/** Mobile | 02 + 7~8 | 0[3-6]x + 7~8 | 070/050x | 15xx/16xx/18xx 대표번호 (8 digits). */
export const KR_CONTACT_PHONE_PATTERN =
  /^(?:01[016789]\d{7,8}|02\d{7,8}|0[3-6][1-5]\d{7,8}|070\d{8}|050\d{8,9}|1[5-9]\d{6})$/;

/** "+82 10-1234-5678" / "010.1234.5678" → "01012345678". */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length >= 10) {
    const rest = digits.slice(2);
    return rest.startsWith('0') ? rest : `0${rest}`;
  }
  return digits;
}

/** "01012345678" → "+821012345678" (null for 대표번호 like 1588xxxx, which have no E.164 form). */
export function toE164Kr(phone: string): string | null {
  const d = normalizePhone(phone);
  if (!d.startsWith('0')) return null;
  return `+82${d.slice(1)}`;
}

/** 01012345678 → 010-****-5678 */
export function maskPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length < 10) return '***';
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

/** 01012345678 → 010-1234-5678, 0212345678 → 02-1234-5678, 15881234 → 1588-1234 */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (/^1[5-9]\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.startsWith('02')) {
    if (d.length === 10) return `02-${d.slice(2, 6)}-${d.slice(6)}`;
    if (d.length === 9) return `02-${d.slice(2, 5)}-${d.slice(5)}`;
  }
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
