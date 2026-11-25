import { normalizeRegionCode, REGION_CODE_PATTERN } from '@house/shared';

/**
 * 법정동 codes are hierarchical by prefix (시도 2 / 시군구 5 / 읍면동 8 / 리 10 digits), so a banner
 * targeting "12150" matches a context of "12150133". Returns every ancestor code of the inputs,
 * each normalized first like every stored code (legacy 46150… → 12150…, a 10-digit 읍면동 code
 * "1215013300" → "12150133").
 */
export function regionCodePrefixes(codes: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    if (!code || !REGION_CODE_PATTERN.test(code)) continue;
    const canonical = normalizeRegionCode(code);
    for (const len of [2, 5, 8, 10]) {
      if (canonical.length >= len) out.add(canonical.slice(0, len));
    }
  }
  return [...out].sort();
}
