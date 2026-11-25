/**
 * 관심 지역 options of the signup step (순천시 생활권 단위, per Login.dc.html).
 * `key` is the stable id sent to the API. No map positions: the mini map behind the picked regions
 * is abstract art, not real geography, so the picks are listed on it rather than placed.
 * ASSUMED contract — see docs/frontend-integration/w-auth.md.
 */
export interface InterestRegion {
  key: string;
  name: string;
  /** Short name on the mini-map pin (defaults to `name`). */
  pin?: string;
  /** Extra search terms (학교, 옛 지명 …). */
  keywords?: readonly string[];
}

export interface InterestRegionGroup {
  key: string;
  label: string;
  regions: readonly InterestRegion[];
}

export const MAX_INTEREST_REGIONS = 5;

export const INTEREST_REGION_GROUPS: readonly InterestRegionGroup[] = [
  {
    key: 'newtown',
    label: '신도시·택지',
    regions: [
      { key: 'sindae', name: '신대지구', keywords: ['신대', '해룡', '레이크파크'] },
      { key: 'seonwol', name: '선월지구', keywords: ['선월', '해룡'] },
      { key: 'ocheon', name: '오천지구', keywords: ['오천동', '국가정원'] },
      { key: 'geumdang', name: '금당지구', keywords: ['금당', '연향'] },
    ],
  },
  {
    key: 'downtown',
    label: '도심',
    regions: [
      { key: 'yeonhyang', name: '연향동', keywords: ['연향'] },
      { key: 'jorye', name: '조례동', keywords: ['조례', '호수공원'] },
      { key: 'wangji', name: '왕지동', keywords: ['왕지', '법원'] },
      { key: 'maegok', name: '매곡동', keywords: ['매곡'] },
      { key: 'deogyeon', name: '덕연동', keywords: ['덕연', '순천역'] },
      { key: 'pungdeok', name: '풍덕동', keywords: ['풍덕', '아랫장'] },
      { key: 'jangcheon', name: '장천동', keywords: ['장천', '터미널'] },
      { key: 'namjeong', name: '남정동', keywords: ['남정'] },
    ],
  },
  {
    key: 'campus',
    label: '대학가',
    regions: [
      {
        key: 'seokhyeon',
        name: '석현동 · 순천대',
        pin: '석현동',
        keywords: ['순천대', '석현'],
      },
      {
        key: 'deogwol',
        name: '덕월동 · 청암대',
        pin: '덕월동',
        keywords: ['청암대', '덕월'],
      },
    ],
  },
  {
    key: 'town',
    label: '읍·면',
    regions: [
      { key: 'haeryong', name: '해룡면', keywords: ['해룡'] },
      { key: 'seomyeon', name: '서면', keywords: ['서면'] },
      { key: 'byeollyang', name: '별량면', keywords: ['별량'] },
      { key: 'nagan', name: '낙안면', keywords: ['낙안', '낙안읍성'] },
      { key: 'juam', name: '주암면', keywords: ['주암'] },
      { key: 'seungju', name: '승주읍', keywords: ['승주', '선암사'] },
    ],
  },
];

export const INTEREST_REGIONS: readonly InterestRegion[] = INTEREST_REGION_GROUPS.flatMap(
  (g) => g.regions,
);
const BY_KEY = new Map(INTEREST_REGIONS.map((r) => [r.key, r]));

export function regionByKey(key: string): InterestRegion | undefined {
  return BY_KEY.get(key);
}

/** Drops unknown keys and duplicates, keeps order, caps at the maximum. */
export function sanitizeRegionKeys(keys: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const k of keys ?? []) {
    if (BY_KEY.has(k) && !out.includes(k)) out.push(k);
    if (out.length === MAX_INTEREST_REGIONS) break;
  }
  return out;
}

export interface ToggleResult {
  keys: string[];
  /** True when the toggle was refused because the maximum is already selected. */
  limitReached: boolean;
}

/** Select / unselect one region, refusing a sixth selection. */
export function toggleRegion(
  selected: readonly string[],
  key: string,
  max = MAX_INTEREST_REGIONS,
): ToggleResult {
  if (selected.includes(key))
    return { keys: selected.filter((k) => k !== key), limitReached: false };
  if (!BY_KEY.has(key)) return { keys: [...selected], limitReached: false };
  if (selected.length >= max) return { keys: [...selected], limitReached: true };
  return { keys: [...selected, key], limitReached: false };
}

const norm = (s: string) => s.replace(/[\s·.]/g, '').toLowerCase();

/** Groups filtered by a free-text query (name or keyword contains it). Empty query → everything. */
export function filterRegionGroups(
  query: string,
  groups: readonly InterestRegionGroup[] = INTEREST_REGION_GROUPS,
): InterestRegionGroup[] {
  const q = norm(query);
  if (!q) return [...groups];
  return groups
    .map((g) => ({
      ...g,
      regions: g.regions.filter(
        (r) => norm(r.name).includes(q) || (r.keywords ?? []).some((k) => norm(k).includes(q)),
      ),
    }))
    .filter((g) => g.regions.length > 0);
}
