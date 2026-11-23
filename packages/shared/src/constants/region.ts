/**
 * Default 시군구 code for 순천시. The API reads REGION_SGG_CODE from env (admin codes can change),
 * this is only the documented default and frontend fallback.
 */
export const DEFAULT_SGG_CODE = '46150';
export const DEFAULT_SIDO_CODE = '46';
export const DEFAULT_REGION_NAME = '전라남도 순천시';

/** Map center (순천시청 부근) and default zoom for the Naver map. */
export const DEFAULT_MAP_CENTER = { lat: 34.950637, lng: 127.487214 } as const;
export const DEFAULT_MAP_ZOOM = 13;

/** 법정동코드 is 10 digits: 시도(2) 시군구(3) 읍면동(3) 리(2). */
export const REGION_CODE_LENGTH = { SIDO: 2, SGG: 5, EMD: 8, FULL: 10 } as const;
export const REGION_CODE_PATTERN = /^\d{2}(\d{3}(\d{3}(\d{2})?)?)?$/;

export function sggCodeOf(code: string): string {
  return code.slice(0, REGION_CODE_LENGTH.SGG);
}
