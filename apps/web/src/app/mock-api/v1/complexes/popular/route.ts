import {
  DEFAULT_SGG_CODE,
  popularComplexesQuerySchema,
  type PopularComplexItem,
} from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { POPULAR_COMPLEXES } from './_ranking';

// GET /api/v1/complexes/popular?limit&emdCode — public "자주 찾는 단지" ranking (complexes module,
// `popularComplexesQuerySchema`) → bare `PopularComplexItem[]`. The backend has no asset-type
// filter (the ranking is apartments); `assetTypes` is ignored like the backend does.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const parsed = popularComplexesQuerySchema.safeParse({ limit: sp.get('limit') ?? undefined });
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const items: PopularComplexItem[] = POPULAR_COMPLEXES.slice(0, parsed.data.limit).map((c) => ({
    id: c.id,
    name: c.name,
    assetType: c.assetType,
    roadAddress: null,
    jibunAddress: null,
    sggCode: DEFAULT_SGG_CODE,
    emdCode: null,
    emdName: c.emdName,
    lat: c.lat,
    lng: c.lng,
    households: c.households,
    buildings: null,
    builtYear: c.builtYear,
    approvalDate: null,
    activeListingCount: c.activeListingCount,
    favoriteCount: 0,
    viewCount: c.weeklyViewCount,
    rank: c.rank,
    score: c.weeklyViewCount,
    listingCounts: {
      total: c.activeListingCount,
      byDealType: {
        PRESALE: c.dealCounts.presale,
        SALE: c.dealCounts.sale,
        JEONSE: c.dealCounts.jeonse,
        MONTHLY: c.dealCounts.monthly,
      },
    },
  }));
  return mockJson(items);
}
