import { PUBLIC_LISTING_STATUSES } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { MY_OFFICE_CODE } from '../../_fixtures';
import {
  findListing,
  isMine,
  isPrimaryMine,
  listingNotFound,
  listingsContext,
  toView,
} from '../../_store';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/agency/listings/:id/co-brokers — the caller's agency joins a public listing as a
 * co-broker (AGENCY_OWNER). Body (assumed) `{ contactName?, contactPhone? }`.
 */
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true, ownerOnly: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 400);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !PUBLIC_LISTING_STATUSES.includes(listing.status)) return listingNotFound();
  if (isMine(listing)) {
    return mockError(409, 'LISTING_ALREADY_CO_BROKER', '이미 공동중개 중인 매물입니다.');
  }
  listing.offices = [...listing.offices, MY_OFFICE_CODE];
  listing.updatedAt = new Date().toISOString();
  return mockJson(toView(listing), { status: 201 });
}

/** DELETE /api/v1/agency/listings/:id/co-brokers — withdraw (the primary office cannot). 204. */
export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true, ownerOnly: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 300);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (isPrimaryMine(listing)) {
    return mockError(
      409,
      'LISTING_PRIMARY_CANNOT_WITHDRAW',
      '최초 등록 사무소는 공동중개에서 나갈 수 없습니다. 매물을 내리려면 상태를 변경해 주세요.',
    );
  }
  listing.offices = listing.offices.filter((c) => c !== MY_OFFICE_CODE);
  return new NextResponse(null, { status: 204 });
}
