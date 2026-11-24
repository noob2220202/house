import { mapSearchQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { LISTINGS } from '../_fixtures';
import { forcedFailure, queryObject, validationError } from '../_query';
import { parseExtraFilters, searchMapWire } from '../_search';

// GET /api/v1/map/search?bbox&zoom&…filters — public (listings module).
// Query = `mapSearchQuerySchema` (@house/shared) + ASSUMED `roomTypes`, `landZones`, `landCategories`.
// zoom ≤ 12 → 읍면동 clusters · ≤ 15 → grid clusters · above → complex / listing markers.
// Answers `MapSearchResult` (@house/shared): { kind, zoom, bbox, total, clusters, complexes,
// listings, truncated }.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 120);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const parsed = mapSearchQuerySchema.safeParse(queryObject(req));
  if (!parsed.success) return validationError(parsed.error);
  const { bbox, zoom, ...filter } = parsed.data;
  return mockJson(
    searchMapWire(LISTINGS, bbox, zoom, { ...filter, ...parseExtraFilters(req.nextUrl.searchParams) }),
  );
}
