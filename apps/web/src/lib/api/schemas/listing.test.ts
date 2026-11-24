import type { ListingSummary as WireListingSummary } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  listingDisplayName,
  listingPageSchema,
  listingSummarySchema,
  parseFloorLabel,
} from './listing';

/** A `ListingSummary` exactly as the listings mapper serializes it. */
const wire: WireListingSummary = {
  id: 'L01',
  listingNo: '100412',
  dealType: 'SALE',
  assetType: 'APT',
  status: 'ACTIVE',
  title: '올수리 · 호수공원 조망',
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
  roomType: null,
  landZone: null,
  landCategory: null,
  direction: 'SOUTH',
  builtYear: 2019,
  roadAddress: '전남광주통합특별시 순천시 해룡면 신대2로 40',
  buildingName: null,
  dong: '103동',
  emdCode: '1215033028',
  emdName: '해룡면 신대리',
  lat: 34.93,
  lng: 127.55,
  complex: { id: 'C01', name: '신대 레이크파크 1단지' },
  coverPhoto: {
    mediaId: 'm1',
    thumbUrl: '/media/m1/thumb.webp',
    mediumUrl: '/media/m1/medium.webp',
    largeUrl: '/media/m1/large.webp',
    caption: null,
    isCover: true,
  },
  photoCount: 14,
  options: [],
  verifiedAt: '2026-11-22T02:00:00.000Z',
  publishedAt: '2026-11-20T00:20:00.000Z',
  primaryAgency: { id: 'b01', name: '신대중앙 공인중개사사무소' },
  agencyCount: 2,
  viewCount: 10,
  favoriteCount: 3,
};

describe('parseFloorLabel (shared floorLabel output)', () => {
  it('reads exact, class, basement and total-only labels', () => {
    expect(parseFloorLabel('12/25')).toEqual({ floor: 12, totalFloors: 25, floorClass: null });
    expect(parseFloorLabel('고/25')).toEqual({ floor: null, totalFloors: 25, floorClass: 'HIGH' });
    expect(parseFloorLabel('B1/5')).toEqual({ floor: -1, totalFloors: 5, floorClass: null });
    expect(parseFloorLabel('3층')).toEqual({ floor: 3, totalFloors: null, floorClass: null });
    expect(parseFloorLabel('-/25층')).toEqual({ floor: null, totalFloors: 25, floorClass: null });
    expect(parseFloorLabel('?')).toEqual({ floor: null, totalFloors: null, floorClass: null });
  });
});

describe('listingSummarySchema (backend ListingSummary → card)', () => {
  it('maps complex, cover photo and floor label onto the card keys', () => {
    const card = listingSummarySchema.parse(wire);
    expect(card).toMatchObject({
      complexId: 'C01',
      complexName: '신대 레이크파크 1단지',
      coverPhotoUrl: '/media/m1/medium.webp',
      floor: null,
      totalFloors: 25,
      floorClass: 'HIGH',
      floorLabel: '고/25',
      exclusiveAreaPyeong: 25.7,
      emdName: '해룡면 신대리',
      primaryAgency: { id: 'b01', name: '신대중앙 공인중개사사무소' },
    });
    expect(listingDisplayName(card)).toBe('신대 레이크파크 1단지');
  });

  it('derives the 원룸 room type from the room count and keeps the flat shape as is', () => {
    const room = listingSummarySchema.parse({
      ...wire,
      assetType: 'ONEROOM',
      rooms: 2,
      complex: null,
      coverPhoto: null,
      floorLabel: '3/4',
    });
    expect(room).toMatchObject({ roomType: 'TWO_ROOM', floor: 3, totalFloors: 4 });
    expect(room.complexId ?? null).toBeNull();
    const flat = listingSummarySchema.parse({
      id: 'x',
      assetType: 'APT',
      dealType: 'SALE',
      complexName: '해오름',
      coverPhotoUrl: '/a.jpg',
      floor: 7,
      totalFloors: 15,
    });
    expect(flat).toMatchObject({
      complexName: '해오름',
      coverPhotoUrl: '/a.jpg',
      floor: 7,
      totalFloors: 15,
    });
  });

  it('parses a whole page of wire rows', () => {
    const page = listingPageSchema.parse({
      items: [wire, { ...wire, id: 'L02', coverPhoto: null }],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
    expect(page.items.map((l) => l.coverPhotoUrl)).toEqual(['/media/m1/medium.webp', undefined]);
  });
});
