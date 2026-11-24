import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { MOCK_ADDRESSES } from '../_fixtures';

const squash = (s: string) => s.replace(/\s+/g, '');

/** 법정동/리 → 10-digit 법정동코드 (canonical 12150…, the same codes as the complex fixtures). */
const EMD_CODES: readonly (readonly [string, string])[] = [
  ['신대리', '1215033028'],
  ['선월리', '1215033029'],
  ['조례동', '1215012000'],
  ['연향동', '1215012100'],
  ['오천동', '1215011900'],
  ['왕지동', '1215012200'],
  ['석현동', '1215011000'],
  ['덕연동', '1215011500'],
  ['장천동', '1215010400'],
  ['풍덕동', '1215011800'],
];
const emdCodeOf = (jibun: string): string | null =>
  EMD_CODES.find(([name]) => jibun.includes(` ${name} `))?.[1] ?? null;

/**
 * GET /api/v1/geo/geocode?query=<address> → `{ items: [{ roadAddress, jibunAddress?, zipCode?,
 * buildingName?, lat, lng, emdCode }] }` (max 10). Address search with coordinates — the API
 * proxies Kakao Local (주소 검색) server-side, limited to the service region, and adds the canonical
 * 10-digit 법정동코드 of each hit (null when the reverse lookup fails).
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 200);
  const query = squash(req.nextUrl.searchParams.get('query') ?? '');
  if (query.length < 2) {
    return mockError(400, 'VALIDATION_FAILED', '검색어를 2자 이상 입력해 주세요.', [
      { path: 'query', message: '검색어를 2자 이상 입력해 주세요.' },
    ]);
  }
  const items = MOCK_ADDRESSES.filter(
    (a) =>
      squash(a.roadAddress).includes(query) ||
      squash(a.jibunAddress).includes(query) ||
      (a.buildingName ? squash(a.buildingName).includes(query) : false),
  ).slice(0, 10);
  return mockJson({ items: items.map((a) => ({ ...a, emdCode: emdCodeOf(a.jibunAddress) })) });
}
