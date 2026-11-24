import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { COMPLEXES } from '../_fixtures';

/**
 * GET /api/v1/deal-requests/address-match?roadAddress&buildingName&bcode  (ASSUMED endpoint)
 * Resolves a road address from the postcode search to a registered complex (단지 확인됨) with its
 * area types and market hints, plus the geocoded point / 법정동.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 250);
  const sp = req.nextUrl.searchParams;
  const roadAddress = (sp.get('roadAddress') ?? '').trim();
  const buildingName = (sp.get('buildingName') ?? '').trim();
  if (!roadAddress)
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'roadAddress', message: '주소를 입력해 주세요.' },
    ]);
  const hay = `${roadAddress} ${buildingName}`;
  const complex = COMPLEXES.find((c) => c.match.some((m) => hay.includes(m)));
  if (!complex) {
    return mockJson({
      emdCode: sp.get('bcode') || null,
      emdName: null,
      lat: null,
      lng: null,
      complex: null,
    });
  }
  return mockJson({
    emdCode: complex.emdCode,
    emdName: complex.emdName,
    lat: complex.lat,
    lng: complex.lng,
    complex: {
      id: complex.id,
      name: complex.name,
      emdName: complex.emdName,
      households: complex.households,
      builtYear: complex.builtYear,
      floorsMax: complex.floorsMax,
      areaTypes: complex.areaTypes,
      market: complex.market,
    },
  });
}
