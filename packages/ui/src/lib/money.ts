/**
 * 만원 money helpers used by MoneyInput. All amounts are integer 만원 (44500 = 4억 4,500만원).
 * Kept dependency-free so the UI package does not depend on @house/shared.
 */

/**
 * Parses what people type into a 만원 field: "44,500" → 44500, "4억 4,500" → 44500, "4.5억" → 45000,
 * "3억" → 30000, "2천" → 2000, "4억 4,500만원" → 44500. Returns null for empty or unparsable text.
 */
export function parseManwonInput(input: string): number | null {
  const s = input.replace(/[\s,]/g, '').replace(/만원?$/, '');
  if (s === '') return null;
  const m = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)천)?(\d+)?$/.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  const total = Number(m[1] ?? 0) * 10000 + Number(m[2] ?? 0) * 1000 + Number(m[3] ?? 0);
  return Number.isFinite(total) ? Math.round(total) : null;
}

/**
 * Thousands separators while typing: "44500" → "44,500", "0044,5" → "445". Text that is not just
 * digits and commas ("4억 4,500") is returned unchanged so 억/천 input keeps working.
 */
export function formatManwonInput(input: string): string {
  if (!/^[\d,\s]*$/.test(input)) return input;
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits === '' ? '' : Number(digits).toLocaleString('ko-KR');
}

/** Korean reading of a 만원 amount: 44500 → "4억 4,500만원", 30000 → "3억원", 9500 → "9,500만원". */
export function formatManwonReading(manwon: number): string {
  if (!Number.isFinite(manwon)) return '';
  const sign = manwon < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(manwon));
  const eok = Math.floor(abs / 10000);
  const rest = abs % 10000;
  if (eok === 0) return `${sign}${rest.toLocaleString('ko-KR')}만원`;
  if (rest === 0) return `${sign}${eok.toLocaleString('ko-KR')}억원`;
  return `${sign}${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만원`;
}

/** Quick-add button text: 10000 → "+1억", 5000 → "+5천", 500 → "+500". */
export function manwonStepLabel(step: number): string {
  if (step >= 10000 && step % 10000 === 0) return `+${(step / 10000).toLocaleString('ko-KR')}억`;
  if (step >= 1000 && step % 1000 === 0 && step < 10000) return `+${step / 1000}천`;
  return `+${step.toLocaleString('ko-KR')}`;
}
