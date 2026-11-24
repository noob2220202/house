import { ListingStatus, listingStatusChangeSchema } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { canTransition } from '@/features/a-listings/lib/status';
import { mockDelay, mockJson } from '@/lib/mock';
import {
  findListing,
  invalidTransition,
  isMine,
  isPrimaryMine,
  listingNotFound,
  listingsContext,
  notMember,
  readJson,
  toView,
  validationError,
} from '../../_store';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/agency/listings/:id/status (`listingStatusChangeSchema`) — ACTIVE ↔ RESERVED → CLOSED,
 * ACTIVE ↔ HIDDEN (broker-initiated; operator-hidden listings cannot be re-opened). 409
 * `LISTING_INVALID_STATUS_TRANSITION` otherwise.
 */
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 300);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (!isPrimaryMine(listing)) return notMember();
  const parsed = listingStatusChangeSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const to = parsed.data.status;
  if (
    !canTransition(listing.status, to, {
      isPrimary: true,
      hiddenByOperator: !!listing.hiddenReason,
    })
  ) {
    return invalidTransition();
  }
  const now = new Date().toISOString();
  listing.status = to;
  listing.closedAt = to === ListingStatus.CLOSED ? now : null;
  listing.updatedAt = now;
  return mockJson(toView(listing));
}
