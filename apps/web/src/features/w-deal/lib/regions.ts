import { env } from '@/config/env';

/**
 * 순천시 생활권 offered in the 구하기 region picker.
 *
 * The picker loads the regions from `GET /regions` so the codes are the backend's (D1). This static
 * list supplies the presentation (which names lead the picker as "주요 지역", chip hints) and is the
 * fallback while loading, when the endpoint fails, and for server-rendered names. Its codes are the
 * REAL 법정동 codes of 순천시 (행정안전부 법정동코드, 46150 → 12150 since 2026-07-01 — the same list
 * the API seeds its region table from, apps/api/src/modules/complexes/regions/suncheon-regions.data.ts),
 * so a request sent from the fallback still targets real regions. Hints only state facts of the
 * code itself or well-known landmarks inside that 법정동.
 * See docs/frontend-integration/w-deal.md.
 */
export interface RegionOption {
  /** 법정동 code (8 digits 읍면동, 10 digits 리) sent in `regionCodes`. */
  code: string;
  name: string;
  /** Caption inside the chip. */
  hint?: string;
  group: 'popular' | 'more';
}

export const SUNCHEON_REGIONS: readonly RegionOption[] = [
  { code: '1215031022', name: '신대지구', hint: '해룡면 신대리', group: 'popular' },
  { code: '1215031028', name: '선월지구', hint: '해룡면 선월리', group: 'popular' },
  { code: '12150114', name: '연향동', group: 'popular' },
  { code: '12150133', name: '조례동', hint: '호수공원', group: 'popular' },
  { code: '12150126', name: '오천동', hint: '오천지구', group: 'popular' },
  { code: '12150132', name: '왕지동', group: 'popular' },
  { code: '12150115', name: '풍덕동', group: 'more' },
  { code: '12150111', name: '조곡동', group: 'more' },
  { code: '12150108', name: '석현동', hint: '순천대 인근', group: 'more' },
  { code: '12150107', name: '매곡동', group: 'more' },
  { code: '12150119', name: '장천동', group: 'more' },
  { code: '12150127', name: '덕월동', group: 'more' },
  { code: '12150320', name: '서면', group: 'more' },
];

/**
 * Display names of the provisional region codes the mock fixtures (src/app/mock-api) still use, so
 * mock-mode screens keep their names. Consulted ONLY in API mock mode: never offered in a picker,
 * never sent, never used against the real API.
 */
const MOCK_REGION_NAMES: Readonly<Record<string, string>> = {
  '1215033028': '신대지구',
  '1215033029': '선월지구',
  '1215012100': '연향동',
  '1215012000': '조례동',
  '1215011900': '오천동',
  '1215012200': '왕지동',
  '1215011800': '풍덕동',
  '1215011500': '덕연동',
  '1215011000': '석현동',
  '1215010900': '매곡동',
  '1215010400': '장천동',
  '1215011700': '덕월동',
  '1215031000': '서면',
};

const BY_CODE = new Map(SUNCHEON_REGIONS.map((r) => [r.code, r]));
const PRESET_BY_NAME = new Map(SUNCHEON_REGIONS.map((r) => [r.name, r]));

/** Region display name for a code ("1215012100" → "연향동"); unknown codes are shown as-is. */
export function regionName(code: string): string {
  return BY_CODE.get(code)?.name ?? (env.apiMock ? MOCK_REGION_NAMES[code] : undefined) ?? code;
}

/** Region as returned by `GET /regions`. */
export interface RegionSource {
  code: string;
  name: string;
  parentName?: string | null;
}

/**
 * Picker options from the backend regions: the preset's hint / group by name ("주요 지역"
 * first, in preset order), other regions after them in API order. Falls back to the static list.
 */
export function toRegionOptions(items: readonly RegionSource[] | undefined): RegionOption[] {
  if (!items || items.length === 0) return [...SUNCHEON_REGIONS];
  const rank = (name: string) => {
    const i = SUNCHEON_REGIONS.findIndex((r) => r.name === name);
    return i < 0 ? SUNCHEON_REGIONS.length : i;
  };
  return items
    .map((item, i) => {
      const preset = PRESET_BY_NAME.get(item.name);
      const option: RegionOption = {
        code: item.code,
        name: item.name,
        hint: preset?.hint ?? item.parentName ?? undefined,
        group: preset?.group ?? 'more',
      };
      return { option, order: rank(item.name) * 1000 + i };
    })
    .sort((a, b) => a.order - b.order)
    .map((x) => x.option);
}

/** Name lookup over picker options, falling back to the static list. */
export function regionNamer(options: readonly RegionOption[]): (code: string) => string {
  const map = new Map(options.map((r) => [r.code, r.name]));
  return (code) => map.get(code) ?? regionName(code);
}

/** "연향동 · 조례동 외 2곳" */
export function regionSummary(
  codes: readonly string[],
  max = 2,
  nameOf: (code: string) => string = regionName,
): string {
  if (codes.length === 0) return '';
  const names = codes.map((c) => nameOf(c));
  const shown = names.slice(0, max).join(' · ');
  return names.length > max ? `${shown} 외 ${names.length - max}곳` : shown;
}
