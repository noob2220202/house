import { listingVerificationSchema } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { MOCK_VERIFICATION_VALID_DAYS, addDays, dayString } from '../../_fixtures';
import {
  findListing,
  isMine,
  listingNotFound,
  listingsContext,
  readJson,
  toView,
  validationError,
} from '../../_store';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/agency/listings/:id/verifications (`listingVerificationSchema`) — adds a 실매물 확인
 * record; `verifiedAt` (and the assumed `verificationDueAt` = +30 days) follow the latest record.
 * Any member of a co-brokering office may record one.
 */
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 300);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  const parsed = listingVerificationSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  if (parsed.data.verifiedAt > dayString(0)) {
    return validationError([
      { path: ['verifiedAt'], message: '확인일은 오늘 이후일 수 없습니다.' },
    ]);
  }
  listing.verifications = [
    {
      id: `ver-${Date.now().toString(36)}`,
      method: parsed.data.method,
      verifiedAt: parsed.data.verifiedAt,
      note: parsed.data.note ?? null,
      verifiedByName: ctx.isOwner ? '김서진' : '오세린',
    },
    ...listing.verifications,
  ].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
  const latest = listing.verifications[0]!.verifiedAt.slice(0, 10);
  listing.verifiedAt = latest;
  listing.verificationDueAt = addDays(latest, MOCK_VERIFICATION_VALID_DAYS);
  listing.updatedAt = new Date().toISOString();
  return mockJson(toView(listing), { status: 201 });
}
