import { AssetType, DealType, ListingStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { markPrimary } from './queries';
import { agencyListingPageSchema, agencyListingSchema, listingPhotoListSchema } from './schemas';

const PHOTO = {
  mediaId: 'm1',
  thumbUrl: '/media/m1/thumb.webp',
  mediumUrl: '/media/m1/medium.webp',
  largeUrl: '/media/m1/large.webp',
  caption: '거실',
  isCover: true,
};

/** Trimmed `AgencyListingDetail` as the API sends it. */
const DETAIL = {
  id: 'l1',
  status: ListingStatus.DRAFT,
  dealType: DealType.SALE,
  assetType: AssetType.ONEROOM,
  title: null,
  salePrice: 18000,
  maintenanceFeeWon: 50_000,
  maintenanceFee: {
    billingType: 'ACTUAL',
    items: [{ kind: 'WATER', included: true }],
    unavailableReason: null,
  },
  floorDisplay: 'EXACT',
  options: [],
  emdName: '석현동',
  isPrimaryAgency: false,
  version: 4,
  latestVerification: { method: 'SITE_VISIT', verifiedAt: '2026-11-20' },
  property: {
    id: 'p1',
    assetType: AssetType.ONEROOM,
    roadAddress: '대학로 15',
    emdCode: '1215011000',
    lat: 34.96,
    lng: 127.48,
    buildingUse: 'MULTI_FAMILY_HOUSE',
    complexId: null,
    areaTypeId: null,
    ho: null,
  },
  photos: [PHOTO],
  agencies: [],
  verifications: [
    { id: 'v1', method: 'SITE_VISIT', verifiedAt: '2026-11-20', note: null, byAdmin: false },
  ],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
};

describe('agencyListingSchema (API AgencyListingDetail → console view)', () => {
  it('maps the flag, the photo URLs, the 읍면동 name and keeps the new 명시사항 fields', () => {
    const l = agencyListingSchema.parse(DETAIL);
    expect(l.isPrimary).toBe(false);
    expect(l.version).toBe(4);
    expect(l.verifiedAt).toBe('2026-11-20');
    expect(l.photos[0]).toMatchObject({
      mediaId: 'm1',
      url: PHOTO.mediumUrl,
      thumbUrl: PHOTO.thumbUrl,
    });
    expect(l.property).toMatchObject({
      emdName: '석현동',
      emdCode: '1215011000',
      buildingUse: 'MULTI_FAMILY_HOUSE',
    });
    expect(l.maintenanceFee).toEqual({
      billingType: 'ACTUAL',
      items: [{ kind: 'WATER', included: true }],
      unavailableReason: null,
    });
    // PUT /photos answers with the photos only.
    expect(listingPhotoListSchema.parse([PHOTO])[0]?.url).toBe(PHOTO.mediumUrl);
  });
});

describe('agency listing rows (API ListingSummary → console row)', () => {
  const summary = (id: string, primaryId: string) => ({
    id,
    status: ListingStatus.ACTIVE,
    dealType: DealType.SALE,
    assetType: AssetType.APT,
    roadAddress: '전남광주통합특별시 순천시 해룡면 신대1로 30',
    buildingName: null,
    complex: { id: 'c1', name: '신대 레이크파크 1단지' },
    coverPhoto: PHOTO,
    primaryAgency: {
      id: primaryId,
      name: primaryId === 'me' ? '우리 사무소' : '호수공원 공인중개사사무소',
    },
    agencyCount: 2,
    photoCount: 1,
  });

  it('names the row from the complex and marks the rows the caller is primary on', () => {
    const page = agencyListingPageSchema.parse({
      items: [summary('a', 'me'), summary('b', 'other')],
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });
    expect(page.items[0]).toMatchObject({
      name: '신대 레이크파크 1단지',
      coverPhotoUrl: PHOTO.thumbUrl,
    });
    const marked = markPrimary(page, 'me');
    expect(marked.items.map((r) => [r.isPrimary, r.primaryAgencyName])).toEqual([
      [true, null],
      [false, '호수공원 공인중개사사무소'],
    ]);
    // Without the caller's agency the API rows are left as parsed.
    expect(markPrimary(page, undefined)).toBe(page);
  });
});
