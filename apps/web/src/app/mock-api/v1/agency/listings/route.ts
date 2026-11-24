import { randomUUID } from 'node:crypto';
import { FloorDisplay, ListingStatus } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { isVerificationDue } from '@/features/a-listings/lib/status';
import { mockCsv, mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { MY_OFFICE_CODE, type StoredListing } from './_fixtures';
import {
  applyDraft,
  isMine,
  isPrimaryMine,
  listingsContext,
  nextListingNo,
  parseDraft,
  priceSortOf,
  readJson,
  toItem,
  toView,
  validationError,
} from './_store';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);

const SORTERS: Record<string, (a: StoredListing, b: StoredListing) => number> = {
  UPDATED: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  LATEST: (a, b) => time(b.createdAt) - time(a.createdAt),
  VERIFY_DUE: (a, b) =>
    (time(a.verificationDueAt) || Number.MAX_SAFE_INTEGER) -
    (time(b.verificationDueAt) || Number.MAX_SAFE_INTEGER),
  PRICE_DESC: (a, b) => priceSortOf(b) - priceSortOf(a),
  PRICE_ASC: (a, b) => priceSortOf(a) - priceSortOf(b),
  VIEWS: (a, b) => b.viewCount - a.viewCount,
};

/**
 * GET /api/v1/agency/listings — listings of the caller's agency, own and co-brokered.
 * Query: statuses (csv), dealTypes (csv), primaryOnly (API) + the console's q, assetTypes (csv),
 * verificationDue, coBrokered, sort; page, pageSize → pagination envelope of rows.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = listingsContext(req);
  if ('status' in ctx) return ctx;
  await mockDelay(req, 250);
  const sp = req.nextUrl.searchParams;
  if (sp.get('_fail') === '1') {
    return mockJson(
      { code: 'UNKNOWN_ERROR', message: '일시적인 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
  const statuses = mockCsv(sp, 'statuses');
  const primaryOnly = sp.get('primaryOnly') === 'true';
  const deals = mockCsv(sp, 'dealTypes');
  const assets = mockCsv(sp, 'assetTypes');
  const q = squash(sp.get('q') ?? '');
  const due = sp.get('verificationDue') === 'true';
  const co = sp.get('coBrokered') === 'true';

  const rows = ctx.state.listings
    .filter(isMine)
    .filter((l) => statuses.length === 0 || statuses.includes(l.status))
    .filter((l) => deals.length === 0 || deals.includes(l.dealType))
    .filter((l) => assets.length === 0 || assets.includes(l.property.assetType))
    .filter((l) => !due || isVerificationDue(l))
    .filter((l) => !co || !isPrimaryMine(l))
    .filter((l) => !primaryOnly || isPrimaryMine(l))
    .filter((l) => {
      if (!q) return true;
      const hay = squash(
        [
          l.complex?.name,
          l.property.buildingName,
          l.property.roadAddress,
          l.property.jibunAddress,
          l.property.dong,
          // Like the API: 호 is searched only on the office's own (primary) listings.
          isPrimaryMine(l) ? l.property.ho : null,
          l.title,
          l.listingNo,
        ]
          .filter(Boolean)
          .join(' '),
      );
      return hay.includes(q);
    })
    .sort(SORTERS[sp.get('sort') ?? 'UPDATED'] ?? SORTERS.UPDATED);

  const page = mockPaginate(rows, req, { pageSize: 10 });
  return mockJson({ ...page, items: page.items.map(toItem) });
}

/** POST /api/v1/agency/listings — create a DRAFT (`listingDraftSchema`); the caller's agency is primary. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 350);
  const body = await readJson(req);
  if (!body) return validationError([{ path: [], message: '요청 본문이 올바르지 않습니다.' }]);
  const parsed = parseDraft(body);
  if ('error' in parsed) return parsed.error;

  const now = new Date().toISOString();
  const id = randomUUID();
  const listing = {
    id,
    code: id,
    offices: [MY_OFFICE_CODE],
    listingNo: nextListingNo(ctx.state),
    status: ListingStatus.DRAFT,
    floorDisplay: FloorDisplay.EXACT,
    maintenanceFee: null,
    options: [],
    version: 0,
    publishedAt: null,
    expiresAt: null,
    closedAt: null,
    hiddenReason: null,
    verifiedAt: null,
    verificationDueAt: null,
    viewCount: 0,
    favoriteCount: 0,
    inquiryCount: 0,
    createdAt: now,
    updatedAt: now,
    isPrimary: true,
    photos: [],
    verifications: [],
    agencies: [],
  } as unknown as StoredListing;
  applyDraft(listing, parsed.data);
  ctx.state.listings.unshift(listing);
  return mockJson(toView(listing), { status: 201 });
}
