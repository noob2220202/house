import { AssetType } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockCsv, mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { REGIONS, splitByDeal } from '../_fixtures';

const ASSET_TYPES = new Set<string>(Object.values(AssetType));

/**
 * 평균 평당가 (만원/평) of the category — only where Korean listings are compared that way:
 * 아파트 (공급 평당), 토지 (대지 평당), 상가 (전용 평당). 원룸·투룸 (보증금/월세) and 주택 → null.
 */
function perPyeongFor(types: readonly AssetType[], all: boolean, aptPerPyeong: number) {
  if (all || types.includes(AssetType.APT)) return aptPerPyeong;
  if (types.includes(AssetType.LAND)) return Math.round(aptPerPyeong * 0.12);
  if (types.includes(AssetType.COMMERCIAL)) return Math.round(aptPerPyeong * 1.45);
  return null;
}

// GET /api/v1/home/popular-regions?assetTypes&limit — ASSUMED endpoint: 읍면동 ranking by weekly
// views with active-listing counts per deal type ("사람들이 자주 찾는 단지" → 지역).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const assetTypes = mockCsv(sp, 'assetTypes');
  if (assetTypes.some((a) => !ASSET_TYPES.has(a))) {
    return mockError(400, 'VALIDATION_FAILED', '요청 값이 올바르지 않습니다.', [
      { path: 'assetTypes', message: '알 수 없는 매물 종류입니다.' },
    ]);
  }
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 10));
  const types = (assetTypes.length ? assetTypes : [...ASSET_TYPES]) as AssetType[];
  const all = assetTypes.length === 0;
  const items = REGIONS.map((r) => {
    const count = all ? r.listingCount : types.reduce((sum, t) => sum + r.byAsset[t], 0);
    // Non-residential categories have no 분양권.
    const residential = types.includes(AssetType.APT);
    const mix = residential
      ? r.dealMix
      : ([0, r.dealMix[1] + r.dealMix[0], r.dealMix[2], r.dealMix[3]] as const);
    return {
      code: r.code,
      name: r.name,
      emdName: r.emdName,
      lat: r.lat,
      lng: r.lng,
      listingCount: count,
      dealCounts: splitByDeal(count, mix),
      avgPricePerPyeong: perPyeongFor(types, all, r.avgPricePerPyeong),
      weeklyViewCount: Math.round((r.weeklyViewCount * count) / Math.max(1, r.listingCount)),
      rankDelta: r.rankDelta,
    };
  })
    .filter((r) => r.listingCount > 0)
    .sort((a, b) => b.weeklyViewCount - a.weeklyViewCount)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));
  return mockJson({ items, updatedAt: '2026-11-23T06:00:00+09:00' });
}
