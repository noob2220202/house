import { Prisma } from '@prisma/client';
import { ListingMapper } from './listing.mapper';
import type { ListingAgencyDetailRow } from './listing.selects';
import type { ListingMediaPort } from './ports/listing-media.port';

const media: ListingMediaPort = {
  assertUsableForListing: () => Promise.resolve(),
  urls: (m) => ({
    thumbUrl: `/t/${m.storageKey}`,
    mediumUrl: `/m/${m.storageKey}`,
    largeUrl: `/l/${m.storageKey}`,
  }),
};
const mapper = new ListingMapper(media);

const agency = {
  id: 'a1',
  name: '순천부동산',
  roadAddress: '순천시 1',
  addressDetail: null,
  phone: '0617491234',
  registrationNumber: '46150-1',
  representativeName: '홍길동',
  status: 'APPROVED' as const,
  deletedAt: null,
  logo: null,
};

function row(): ListingAgencyDetailRow {
  return {
    id: 'l1',
    dealType: 'SALE',
    assetType: 'APT',
    status: 'ACTIVE',
    title: null,
    salePrice: 30000,
    deposit: null,
    monthlyRent: null,
    presalePrice: null,
    premium: null,
    priceSort: 30000,
    maintenanceFeeWon: 0,
    exclusiveArea: new Prisma.Decimal('84.97'),
    rooms: 3,
    baths: 2,
    direction: 'SOUTH',
    floorClass: 'MID',
    floorDisplay: 'CLASS',
    builtYear: 2015,
    emdCode: '4615010400',
    lat: 34.9,
    lng: 127.4,
    photoCount: 1,
    options: [],
    verifiedAt: null,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    viewCount: 1,
    favoriteCount: 0,
    primaryAgencyId: 'a1',
    primaryAgency: { id: 'a1', name: '순천부동산' },
    _count: { agencies: 2 },
    description: null,
    maintenanceFeeItems: [],
    moveInType: 'IMMEDIATE',
    moveInDate: null,
    hiddenReason: null,
    closedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    complex: null,
    property: {
      id: 'p1',
      ho: 'SECRET-HO',
      emdCode: '4615010400',
      complexId: null,
      areaTypeId: null,
      assetType: 'APT',
      roadAddress: '순천시 연향로 1',
      jibunAddress: null,
      buildingName: null,
      dong: '101',
      floor: 9,
      totalFloors: 15,
      exclusiveArea: new Prisma.Decimal('84.97'),
      supplyArea: null,
      landArea: null,
      totalFloorArea: null,
      rooms: 3,
      baths: 2,
      direction: 'SOUTH',
      directionBasis: 'LIVING_ROOM',
      approvalDate: new Date('2015-01-01T00:00:00Z'),
      parkingSpaces: 1,
      heatingType: null,
      zoning: null,
      landCategory: null,
      buildingUse: null,
    },
    photos: [
      {
        mediaId: 'm1',
        caption: null,
        isCover: false,
        media: { storageKey: 'a.webp', variants: null },
      },
      {
        mediaId: 'm2',
        caption: '거실',
        isCover: true,
        media: { storageKey: 'b.webp', variants: null },
      },
    ],
    verifications: [],
    agencies: [
      {
        agencyId: 'a1',
        isPrimary: true,
        status: 'ACTIVE',
        contactMemberId: 'mem1',
        contactName: '김실장',
        contactPhone: '01011112222',
        joinedAt: new Date('2026-01-01T00:00:00Z'),
        agency,
      },
      {
        agencyId: 'a2',
        isPrimary: false,
        status: 'ACTIVE',
        contactMemberId: null,
        contactName: null,
        contactPhone: null,
        joinedAt: new Date('2026-01-02T00:00:00Z'),
        agency: { ...agency, id: 'a2', status: 'SUSPENDED' },
      },
    ],
  };
}

describe('ListingMapper', () => {
  it('public detail hides 호, private note, member ids, the exact floor (CLASS) and suspended agencies', () => {
    const out = mapper.publicDetail(row(), false);
    const json = JSON.stringify(out);
    expect(json).not.toContain('SECRET-HO');
    expect(json).not.toContain('mem1');
    expect(out.property.floor).toBeNull();
    expect(out.floorLabel).toBe('중/15층');
    expect(out.agencies.map((a) => a.agencyId)).toEqual(['a1']);
    expect(out.coverPhoto?.mediaId).toBe('m2');
    expect(out.photos.map((p) => p.mediaId)).toEqual(['m1', 'm2']);
    expect(out.exclusiveAreaPyeong).toBe(25.7);
  });

  it('agency detail includes the private fields', () => {
    const out = mapper.agencyDetail(row(), 'a1');
    expect(out.property.ho).toBe('SECRET-HO');
    expect(out.property.floor).toBe(9);
    expect(out.isPrimaryAgency).toBe(true);
    expect(out.agencies).toHaveLength(2);
  });
});
