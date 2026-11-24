import type { ListingDetail as WireListingDetail } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { complexDetailSchema } from '@/features/w-complex/api/schemas';
import { listingDetailSchema, maintenanceFeeLabels } from '../api/schemas';
import { matchAreaType, withComplexDetail } from './complex';

const wire = {
  id: 'L01',
  dealType: 'SALE',
  assetType: 'APT',
  status: 'ACTIVE',
  title: null,
  salePrice: 44500,
  deposit: null,
  monthlyRent: null,
  presalePrice: null,
  premium: null,
  priceSort: 44500,
  maintenanceFeeWon: 250000,
  exclusiveArea: 84.98,
  exclusiveAreaPyeong: 25.7,
  supplyArea: 112.4,
  floorLabel: '고/25',
  floorClass: 'HIGH',
  rooms: 3,
  baths: 2,
  direction: 'SOUTH',
  builtYear: 2019,
  roadAddress: '순천시 해룡면 신대2로 40',
  buildingName: null,
  dong: '103동',
  emdCode: '1215033028',
  emdName: '해룡면 신대리',
  lat: 34.93,
  lng: 127.55,
  complex: { id: 'C01', name: '신대 레이크파크 1단지', households: 1412, builtYear: 2019 },
  coverPhoto: null,
  photoCount: 1,
  options: [],
  verifiedAt: null,
  publishedAt: null,
  primaryAgency: { id: 'b01', name: '신대중앙' },
  agencyCount: 1,
  viewCount: 3,
  favoriteCount: 0,
  description: '남향',
  maintenanceFee: {
    billingType: 'FIXED',
    items: [
      { kind: 'GENERAL', included: true, amountWon: 150000 },
      { kind: 'WATER', included: true, amountWon: null },
      { kind: 'GAS', included: false, amountWon: null },
    ],
    unavailableReason: null,
  },
  moveInType: 'NEGOTIABLE',
  moveInDate: null,
  floorDisplay: 'CLASS',
  property: {
    assetType: 'APT',
    roadAddress: '순천시 해룡면 신대2로 40',
    jibunAddress: null,
    buildingName: null,
    dong: '103동',
    floor: null,
    totalFloors: 25,
    exclusiveArea: 84.98,
    supplyArea: 112.4,
    landArea: null,
    totalFloorArea: null,
    rooms: 3,
    baths: 2,
    direction: 'SOUTH',
    directionBasis: 'LIVING_ROOM',
    approvalDate: '2019-06-28',
    parkingSpaces: 1800,
    heatingType: null,
    zoning: null,
    landCategory: null,
    buildingUse: 'APARTMENT',
  },
  photos: [
    {
      mediaId: 'p1',
      thumbUrl: '/t.webp',
      mediumUrl: '/m.webp',
      largeUrl: '/l.webp',
      caption: '거실',
      isCover: true,
    },
  ],
  agencies: [],
  latestVerification: { method: 'SITE_VISIT', verifiedAt: '2026-11-22T02:00:00.000Z' },
  isFavorite: false,
} satisfies Omit<WireListingDetail, 'agencies'> & { agencies: [] };

describe('listingDetailSchema (backend ListingDetail)', () => {
  it('maps photos, coordinates, verification and 관리비 items', () => {
    const l = listingDetailSchema.parse(wire);
    expect(l.photos[0]).toEqual({
      id: 'p1',
      url: '/l.webp',
      thumbUrl: '/t.webp',
      caption: '거실',
      isCover: true,
    });
    expect(l.property).toMatchObject({
      lat: 34.93,
      lng: 127.55,
      emdCode: '1215033028',
      emdName: '해룡면 신대리',
    });
    expect(l.verifications).toEqual([
      { method: 'SITE_VISIT', verifiedAt: '2026-11-22T02:00:00.000Z' },
    ]);
    expect(l.maintenanceFeeItems).toEqual(['일반관리비 15만원', '수도료']);
    expect(maintenanceFeeLabels(null)).toEqual([]);
  });

  it('takes 평형, 단지 facts and the latest 실거래 from the complex', () => {
    const listing = listingDetailSchema.parse(wire);
    const complex = complexDetailSchema.parse({
      id: 'C01',
      name: '신대 레이크파크 1단지',
      lat: 34.93,
      lng: 127.55,
      approvalDate: '2019-06-28',
      parkingPerHousehold: 1.27,
      areaTypes: [
        { id: 'A25', exclusiveArea: 59.97, supplyArea: 80.1, pyeongLabel: '25평' },
        { id: 'A34', exclusiveArea: 84.98, supplyArea: 112.4, pyeongLabel: '34평' },
      ],
      latestTrades: [
        {
          id: 't1',
          dealType: 'SALE',
          dealDate: '2026-10-14',
          yearMonth: 202610,
          exclusiveArea: 84.98,
          areaTypeId: 'A34',
          floor: 17,
          price: 43500,
          deposit: null,
          monthlyRent: null,
          cancelled: false,
          contractType: null,
        },
        {
          id: 't0',
          dealType: 'SALE',
          dealDate: '2026-08-01',
          yearMonth: 202608,
          exclusiveArea: 84.98,
          areaTypeId: 'A34',
          floor: 3,
          price: 42000,
          deposit: null,
          monthlyRent: null,
          cancelled: false,
          contractType: null,
        },
      ],
    });
    const merged = withComplexDetail(listing, complex);
    expect(merged.property.areaTypeId).toBe('A34');
    expect(merged.complex).toMatchObject({
      households: 1412,
      approvalDate: '2019-06-28',
      parkingPerHousehold: 1.27,
      latestTrade: { price: 43500, dealDate: '2026-10-14', floor: 17, pyeongLabel: '34평' },
    });
    expect(merged.complex?.areaTypes).toHaveLength(2);
    expect(withComplexDetail(listing, null)).toBe(listing);
  });

  it('matches a 평형 only within ±1㎡', () => {
    const types = [
      { id: 'a', exclusiveArea: 59.9 },
      { id: 'b', exclusiveArea: 84.9 },
    ];
    expect(matchAreaType(types, 84.98)).toBe('b');
    expect(matchAreaType(types, 72)).toBeNull();
    expect(matchAreaType(types, null)).toBeNull();
  });
});
