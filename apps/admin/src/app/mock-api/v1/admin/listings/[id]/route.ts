import type { NextRequest } from 'next/server';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockNotFound } from '@/lib/mock';
import { reportsDb } from '../../reports/_fixtures';
import { listingsDb } from '../_fixtures';

// GET /api/v1/admin/listings/:id (ASSUMED endpoint) — full listing incl. the private 호수,
// co-brokers, 실매물 확인 records, reports and the change history.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const listing = listingsDb().find((l) => l.id === id);
  if (!listing) return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  const reports = reportsDb()
    .filter((r) => r.listingId === id)
    .map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.createdAt }));
  return mockJson({ ...listing, reports });
}
