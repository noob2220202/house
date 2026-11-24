import { AssetType, DealType, Direction, FloorClass } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { listingItemSchema, type ListingItem } from '../api/schemas';
import { listingMeta, listingPriceText, toListingCard } from './listing-card';

const item = (over: Partial<ListingItem>): ListingItem =>
  listingItemSchema.parse({ id: 'l1', assetType: AssetType.APT, dealType: DealType.SALE, ...over });

describe('listingPriceText', () => {
  it('formats sale, jeonse and monthly prices', () => {
    expect(listingPriceText(item({ salePrice: 44500 }))).toBe('4억 4,500');
    expect(listingPriceText(item({ dealType: DealType.JEONSE, deposit: 24000 }))).toBe('2억 4,000');
    expect(
      listingPriceText(item({ dealType: DealType.MONTHLY, deposit: 500, monthlyRent: 42 })),
    ).toBe('500/42');
  });

  it('adds the premium to the 분양가 for 분양권', () => {
    expect(
      listingPriceText(item({ dealType: DealType.PRESALE, presalePrice: 39200, premium: 2700 })),
    ).toBe('4억 1,900');
    expect(
      listingPriceText(item({ dealType: DealType.PRESALE, presalePrice: 35000, premium: -1200 })),
    ).toBe('3억 3,800');
  });

  it('falls back to "가격 협의" when the amount is missing', () => {
    expect(listingPriceText(item({}))).toBe('가격 협의');
  });
});

describe('listingMeta', () => {
  it('apartment: 공급 평형 · 저/중/고 층 · 향', () => {
    expect(
      listingMeta(
        item({
          exclusiveArea: 84.98,
          supplyArea: 112.4,
          floorClass: FloorClass.HIGH,
          totalFloors: 25,
          direction: Direction.SOUTH,
        }),
      ),
    ).toEqual(['34평', '고/25층', '남향']);
  });

  it('oneroom: room type · exact floor · 준공 연도', () => {
    expect(
      listingMeta(
        item({
          assetType: AssetType.ONEROOM,
          dealType: DealType.MONTHLY,
          roomType: 'TWO_ROOM',
          floor: 3,
          totalFloors: 4,
          builtYear: 2019,
        }),
      ),
    ).toEqual(['투룸', '3/4층', '2019년 준공']);
    expect(listingMeta(item({ assetType: AssetType.ONEROOM, rooms: 1 }))).toEqual(['원룸']);
  });

  it('land: 평 and ㎡ from the land area; skips unknown facts', () => {
    expect(listingMeta(item({ assetType: AssetType.LAND, landArea: 512 }))).toEqual([
      '155평',
      '512㎡',
    ]);
    expect(listingMeta(item({ assetType: AssetType.LAND }))).toEqual([]);
  });

  it('accepts decimal strings from the API', () => {
    const parsed = listingItemSchema.parse({
      id: 'l2',
      assetType: AssetType.APT,
      dealType: DealType.SALE,
      supplyArea: '112.40',
    });
    expect(listingMeta(parsed)).toEqual(['34평']);
  });
});

describe('toListingCard', () => {
  it('maps an apartment listing to card props', () => {
    const card = toListingCard(
      item({
        id: 'abc',
        complexName: '신대 레이크파크 1단지',
        dong: '103동',
        salePrice: 44500,
        supplyArea: 112.4,
        floorClass: FloorClass.HIGH,
        totalFloors: 25,
        direction: Direction.SOUTH,
        verifiedAt: '2026-11-22T16:40:00+09:00',
        agencyCount: 3,
      }),
    );
    expect(card).toMatchObject({
      href: '/listing/abc',
      deal: 'sale',
      price: '4억 4,500',
      title: '신대 레이크파크 1단지',
      subtitle: '103동',
      verifiedDate: '26.11.22',
      brokerCount: 3,
      placeholder: 'tower',
      label: '신대 레이크파크 1단지 103동 매매 4억 4,500',
    });
    expect(card.premium).toBeUndefined();
  });

  it('uses the location note as subtitle and exposes the premium of 분양권', () => {
    const room = toListingCard(
      item({
        assetType: AssetType.ONEROOM,
        dealType: DealType.MONTHLY,
        buildingName: '석현동 해오름빌',
        locationNote: '순천대 정문 도보 6분',
        deposit: 500,
        monthlyRent: 42,
      }),
    );
    expect(room.subtitle).toBe('순천대 정문 도보 6분');
    expect(room.placeholder).toBe('room');
    expect(room.verifiedDate).toBeUndefined();

    const presale = toListingCard(
      item({
        dealType: DealType.PRESALE,
        presalePrice: 39200,
        premium: 2700,
        complexName: '선월 하이츠 2차',
      }),
    );
    expect(presale.title).toBe('선월 하이츠 2차');
    expect(presale.premium).toBe(2700);
    expect(presale.deal).toBe('presale');
  });

  it('builds a title from the 동 and asset type when the name is missing', () => {
    expect(toListingCard(item({ assetType: AssetType.LAND, emdName: '왕지동' })).title).toBe(
      '왕지동 토지',
    );
  });
});
