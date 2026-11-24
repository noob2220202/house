import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { MOCK_ADDRESSES } from '../_fixtures';

const squash = (s: string) => s.replace(/\s+/g, '');

/**
 * GET /api/v1/geo/geocode?query=<address> (ASSUMED) → `{ items: [{ roadAddress, jibunAddress?,
 * zipCode?, buildingName?, lat, lng }] }` (max 10). Address search with coordinates — the API
 * proxies Naver geocoding server-side (NAVER_MAP_CLIENT_ID/SECRET), limited to the service region.
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
  return mockJson({ items });
}
