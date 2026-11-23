import { REGION_CODE_PATTERN } from '@house/shared';

/**
 * 법정동 codes are hierarchical by prefix (시도 2 / 시군구 5 / 읍면동 8 / 리 10 digits), so a banner
 * targeting "46150" matches a context of "4615010100". Returns every ancestor code of the inputs.
 */
export function regionCodePrefixes(codes: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    if (!code || !REGION_CODE_PATTERN.test(code)) continue;
    for (const len of [2, 5, 8, 10]) {
      if (code.length >= len) out.add(code.slice(0, len));
    }
  }
  return [...out].sort();
}
