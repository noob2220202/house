import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { findMeComplex, toComplexSummaryWire } from '../../_lookup';
import { meGuard, mockForcedFailure } from '../../_store';

// GET /api/v1/me/favorites/complexes?page&pageSize — 관심 단지, newest first.
// Items = `FavoriteComplexItem` { favoritedAt, complex: ComplexSummary } (complexes module).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const rows = g.state.favoriteComplexes.flatMap((fav) => {
    const complex = findMeComplex(fav.id);
    return complex ? [{ favoritedAt: fav.at, complex: toComplexSummaryWire(complex) }] : [];
  });
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
