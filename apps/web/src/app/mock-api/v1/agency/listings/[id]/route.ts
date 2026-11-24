import { ListingStatus } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import {
  applyDraft,
  findListing,
  isMine,
  isPrimaryMine,
  listingNotFound,
  listingsContext,
  notMember,
  parseDraft,
  publishRequirementsError,
  readJson,
  toView,
  validationError,
} from '../_store';

type Params = { params: Promise<{ id: string }> };

/** GET /api/v1/agency/listings/:id (ASSUMED) — editable listing incl. private 호수; members only (404 otherwise). */
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req);
  if ('status' in ctx) return ctx;
  await mockDelay(req, 200);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  return mockJson(toView(listing));
}

/**
 * PATCH /api/v1/agency/listings/:id — full `listingDraftSchema` body (omitted optional fields are
 * cleared). Only the primary office edits. Published listings must keep passing the publish
 * validator (422 LISTING_PUBLISH_REQUIREMENTS otherwise, nothing is saved).
 */
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 300);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (!isPrimaryMine(listing)) return notMember();
  if (listing.status === ListingStatus.CLOSED) {
    return mockError(
      409,
      'LISTING_INVALID_STATUS_TRANSITION',
      '거래완료된 매물은 수정할 수 없습니다.',
    );
  }
  const body = await readJson(req);
  if (!body) return validationError([{ path: [], message: '요청 본문이 올바르지 않습니다.' }]);
  const parsed = parseDraft(body);
  if ('error' in parsed) return parsed.error;

  const before = structuredClone(listing);
  applyDraft(listing, parsed.data);
  if (listing.status === ListingStatus.ACTIVE || listing.status === ListingStatus.RESERVED) {
    const invalid = publishRequirementsError(listing);
    if (invalid) {
      Object.assign(listing, before);
      return invalid;
    }
  }
  return mockJson(toView(listing));
}

/** DELETE /api/v1/agency/listings/:id — primary office only; 204. */
export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 250);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (!isPrimaryMine(listing)) return notMember();
  ctx.state.listings = ctx.state.listings.filter((l) => l !== listing);
  return new NextResponse(null, { status: 204 });
}
