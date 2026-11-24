import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { findAgencySummary } from '../../../agencies/_fixtures';
import { meGuard } from '../../_store';
import { favoriteAgencies } from './_store';

// GET /api/v1/me/favorites/agencies?page&pageSize — 관심 중개사무소, newest first. ASSUMED (w-agencies).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 80);
  const rows = favoriteAgencies(g.role).flatMap((fav) => {
    const agency = findAgencySummary(fav.id);
    return agency ? [{ ...agency, favoritedAt: fav.at }] : [];
  });
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
