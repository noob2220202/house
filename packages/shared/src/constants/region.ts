/**
 * Default 시군구 code for 순천시. The API reads REGION_SGG_CODE from env, this is only the
 * documented default and frontend fallback.
 *
 * Since 2026-07-01 (전남광주통합특별시 설치를 위한 특별법) 순천시 belongs to 전남광주통합특별시
 * (시도 12): 46150 → 12150. The 읍면동/리 digits did not change (46150132 → 12150132,
 * 4615031022 → 1215031022). Only the new codes are stored; legacy codes that still arrive from
 * old URLs, cached addresses or external APIs are mapped with {@link canonicalRegionCode}.
 */
export const DEFAULT_SGG_CODE = '12150';
export const DEFAULT_SIDO_CODE = '12';
export const DEFAULT_SIDO_NAME = '전남광주통합특별시';
export const DEFAULT_REGION_NAME = '전남광주통합특별시 순천시';

/** Map center (순천시청 부근) and default zoom (13 = Kakao level 7). */
export const DEFAULT_MAP_CENTER = { lat: 34.950637, lng: 127.487214 } as const;
export const DEFAULT_MAP_ZOOM = 13;

/** 법정동코드 is 10 digits: 시도(2) 시군구(3) 읍면동(3) 리(2). */
export const REGION_CODE_LENGTH = { SIDO: 2, SGG: 5, EMD: 8, FULL: 10 } as const;
export const REGION_CODE_PATTERN = /^\d{2}(\d{3}(\d{3}(\d{2})?)?)?$/;

export function sggCodeOf(code: string): string {
  return code.slice(0, REGION_CODE_LENGTH.SGG);
}

/**
 * Legacy 시군구 code → current code, for the 시군구 this service covers. Only the 시군구 part is
 * renumbered, so every 읍면동/리 code under it keeps its trailing digits. Other 시군구 of the
 * former 전라남도 got codes that are not a plain prefix swap (광양 46230 → 12190), so they are
 * deliberately not listed: an unknown code is never guessed.
 */
export const LEGACY_SGG_CODE_ALIASES: Readonly<Record<string, string>> = {
  '46150': '12150', // 전라남도 순천시 → 전남광주통합특별시 순천시 (2026-07-01)
};

/** Legacy 시도 code → current code (only the 시도 rows of the aliased 시군구 above). */
export const LEGACY_SIDO_CODE_ALIASES: Readonly<Record<string, string>> = {
  '46': '12', // 전라남도 → 전남광주통합특별시 (2026-07-01)
};

/**
 * Maps a legacy 법정동코드 (2/5/8/10 digits) to the current code: "46150…" → "12150…" and the
 * bare 시도 "46" → "12". Anything else — other regions, current codes, non-code strings — is
 * returned unchanged (surrounding whitespace trimmed for code-shaped input). Idempotent.
 */
export function canonicalRegionCode(code: string): string {
  const trimmed = code.trim();
  if (!REGION_CODE_PATTERN.test(trimmed)) return code;
  if (trimmed.length === REGION_CODE_LENGTH.SIDO) {
    return LEGACY_SIDO_CODE_ALIASES[trimmed] ?? trimmed;
  }
  const sgg = LEGACY_SGG_CODE_ALIASES[trimmed.slice(0, REGION_CODE_LENGTH.SGG)];
  return sgg ? `${sgg}${trimmed.slice(REGION_CODE_LENGTH.SGG)}` : trimmed;
}

/**
 * Inverse of {@link canonicalRegionCode} for external lookups that may still be keyed by the
 * old code (실거래가 / 브이월드 fallbacks): "12150…" → "46150…", "12" → "46"; `null` when the
 * code has no legacy alias.
 */
export function legacyRegionCode(code: string): string | null {
  const trimmed = code.trim();
  if (!REGION_CODE_PATTERN.test(trimmed)) return null;
  const find = (aliases: Readonly<Record<string, string>>, current: string) =>
    Object.entries(aliases).find(([, now]) => now === current)?.[0] ?? null;
  if (trimmed.length === REGION_CODE_LENGTH.SIDO) return find(LEGACY_SIDO_CODE_ALIASES, trimmed);
  const legacySgg = find(LEGACY_SGG_CODE_ALIASES, trimmed.slice(0, REGION_CODE_LENGTH.SGG));
  return legacySgg ? `${legacySgg}${trimmed.slice(REGION_CODE_LENGTH.SGG)}` : null;
}
