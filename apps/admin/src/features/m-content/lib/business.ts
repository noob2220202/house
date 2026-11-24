/** Digits of a 사업자등록번호 ("123-45-67890" → "1234567890"). */
export function businessNumberDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** "1234567890" / "123 45 67890" → "123-45-67890" (partial input is formatted progressively). */
export function formatBusinessNumber(value: string): string {
  const d = businessNumberDigits(value).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

/**
 * 사업자등록번호 check digit (국세청 algorithm). Returns true for a well-formed 10-digit number
 * whose last digit matches. The all-zero placeholder "000-00-00000" is accepted so the operator can
 * save the form before the real number is issued.
 */
export function isValidBusinessNumber(value: string): boolean {
  const d = businessNumberDigits(value);
  if (d.length !== 10) return false;
  if (/^0{10}$/.test(d)) return true;
  const n = Array.from(d, Number);
  let sum = 0;
  WEIGHTS.forEach((w, i) => {
    sum += w * (n[i] ?? 0);
  });
  sum += Math.floor(((n[8] ?? 0) * 5) / 10);
  return (10 - (sum % 10)) % 10 === n[9];
}
