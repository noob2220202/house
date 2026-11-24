import { ListingStatus } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { MOCK_LISTING_TTL_DAYS, addDays, dayString } from '../../_fixtures';
import {
  findListing,
  invalidTransition,
  isMine,
  isPrimaryMine,
  listingNotFound,
  listingsContext,
  nextListingNo,
  notMember,
  publishRequirementsError,
  toView,
} from '../../_store';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/agency/listings/:id/publish — DRAFT → ACTIVE after the publish validator
 * (공인중개사법 제18조의2 명시사항). Fails with 400 `LISTING_PUBLISH_REQUIREMENTS` and
 * `details: [{ field, label }]`.
 */
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 500);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (!isPrimaryMine(listing)) return notMember();
  if (listing.status !== ListingStatus.DRAFT) return invalidTransition();
  const invalid = publishRequirementsError(listing);
  if (invalid) return invalid;

  const now = new Date().toISOString();
  listing.status = ListingStatus.ACTIVE;
  listing.publishedAt = now;
  listing.expiresAt = `${addDays(dayString(0), MOCK_LISTING_TTL_DAYS)}T23:59:00+09:00`;
  listing.listingNo ??= nextListingNo(ctx.state);
  listing.updatedAt = now;
  return mockJson(toView(listing));
}
