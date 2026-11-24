import { popularComplexesQuerySchema, type AssetType } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockCsv, mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { POPULAR_COMPLEXES } from './_ranking';

// GET /api/v1/complexes/popular?limit[&assetTypes] — public "자주 찾는 단지" ranking by weekly views
// (complexes module). `assetTypes` (CSV) is an ASSUMED extra filter — see w-home.md.
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
  const assetTypes = mockCsv(sp, 'assetTypes') as AssetType[];
  const items = POPULAR_COMPLEXES.filter(
    (c) => assetTypes.length === 0 || assetTypes.includes(c.assetType),
  ).slice(0, parsed.data.limit);
  return mockJson({ items, updatedAt: '2026-11-23T06:00:00+09:00' });
}
