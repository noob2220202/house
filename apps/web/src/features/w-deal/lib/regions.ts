/**
 * 순천시 생활권 offered in the 구하기 region picker.
 *
 * The picker loads the regions from `GET /regions` (assumed endpoint shared with w-map) so the
 * codes are the backend's — whatever 시군구 code it is configured with (12150, D1). This
 * static list only supplies the presentation (which names are "많이 찾는 지역", chip hints) and
 * is the fallback while loading, when the endpoint fails, and for server-rendered names. Its codes
 * mirror the w-map mock (src/app/mock-api/v1/map/_fixtures.ts → REGIONS) so every mock agrees.
 * See docs/frontend-integration/w-deal.md.
 */
export interface RegionOption {
  /** 법정동 code (10 digits) sent in `regionCodes`. */
  code: string;
  name: string;
  /** Caption inside the chip. */
  hint?: string;
  group: 'popular' | 'more';
}

export const SUNCHEON_REGIONS: readonly RegionOption[] = [
  { code: '1215033028', name: '신대지구', hint: '해룡면 신대리', group: 'popular' },
  { code: '1215033029', name: '선월지구', hint: '분양권', group: 'popular' },
  { code: '1215012100', name: '연향동', hint: '금당지구 포함', group: 'popular' },
  { code: '1215012000', name: '조례동', hint: '호수공원', group: 'popular' },
  { code: '1215011900', name: '오천동', hint: '오천지구', group: 'popular' },
  { code: '1215012200', name: '왕지동', group: 'popular' },
  { code: '1215011800', name: '풍덕동', group: 'more' },
  { code: '1215011500', name: '덕연동', group: 'more' },
  { code: '1215011000', name: '석현동', hint: '순천대 인근', group: 'more' },
  { code: '1215010900', name: '매곡동', group: 'more' },
  { code: '1215010400', name: '장천동', hint: '순천역 인근', group: 'more' },
  { code: '1215011700', name: '덕월동', hint: '청암대 인근', group: 'more' },
  { code: '1215031000', name: '서면', group: 'more' },
];

const BY_CODE = new Map(SUNCHEON_REGIONS.map((r) => [r.code, r]));
const PRESET_BY_NAME = new Map(SUNCHEON_REGIONS.map((r) => [r.name, r]));

/** Region display name for a code ("1215012100" → "연향동"); unknown codes are shown as-is. */
export function regionName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

/** Region as returned by `GET /regions`. */
export interface RegionSource {
  code: string;
  name: string;
  parentName?: string | null;
}

/**
 * Picker options from the backend regions: the preset's hint / group by name ("많이 찾는 지역"
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
