import { AssetType, DealType, Direction, FloorClass, ListingStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { AgencyListingItem } from '../api/schemas';
import { headlineAmount, priceText, rowLabel, rowTitle, specLine } from './display';

const row = (patch: Partial<AgencyListingItem>): AgencyListingItem => ({
  id: 'l1',
  status: ListingStatus.ACTIVE,
  dealType: DealType.SALE,
  assetType: AssetType.APT,
  name: '신대 레이크파크 1단지',
  dong: '103동',
  photoCount: 0,
  viewCount: 0,
  favoriteCount: 0,
  inquiryCount: 0,
  agencyCount: 1,
  isPrimary: true,
  ...patch,
});

describe('priceText / headlineAmount', () => {
  it('매매 · 전세 in 억/만', () => {
    expect(priceText(row({ salePrice: 44500 }))).toBe('4억 4,500');
    expect(priceText(row({ dealType: DealType.JEONSE, deposit: 27500 }))).toBe('2억 7,500');
  });

  it('월세 as 보증금/월세 (보증금 0 allowed)', () => {
    expect(priceText(row({ dealType: DealType.MONTHLY, deposit: 3000, monthlyRent: 90 }))).toBe(
      '3,000/90',
    );
    expect(priceText(row({ dealType: DealType.MONTHLY, deposit: 0, monthlyRent: 45 }))).toBe(
      '0/45',
    );
  });

  it('분양권 = 분양가 + 프리미엄 (마이너스 프리미엄 포함)', () => {
    const presale = row({ dealType: DealType.PRESALE, presalePrice: 39200, premium: 2700 });
    expect(headlineAmount(presale)).toBe(41900);
    expect(priceText(presale)).toBe('4억 1,900');
    expect(
      headlineAmount(row({ dealType: DealType.PRESALE, presalePrice: 35000, premium: -1200 })),
    ).toBe(33800);
    expect(headlineAmount(row({ dealType: DealType.PRESALE, presalePrice: 35000 }))).toBe(35000);
  });

  it('drafts without a price say so instead of “가격 협의”', () => {
    expect(priceText(row({}))).toBe('가격 미입력');
    expect(priceText(row({ dealType: DealType.MONTHLY, deposit: 500 }))).toBe('가격 미입력');
    expect(priceText(row({ dealType: DealType.PRESALE, premium: 2700 }))).toBe('가격 미입력');
    expect(headlineAmount(row({ dealType: DealType.JEONSE }))).toBeNull();
  });
});

describe('specLine', () => {
  it('shows 평 from the supply area, the exact floor and the direction', () => {
    expect(
      specLine(
        row({
          supplyArea: 112.4,
          exclusiveArea: 84.98,
          floor: 20,
          totalFloors: 25,
          floorClass: FloorClass.HIGH,
          direction: Direction.SOUTH,
        }),
      ),
    ).toBe('34평 · 20/25층 · 남향');
  });

  it('falls back to the exclusive area and to 저/중/고 when the floor is unknown', () => {
    expect(
      specLine(
        row({
          assetType: AssetType.ONEROOM,
          exclusiveArea: 39.6,
          totalFloors: 4,
          floorClass: FloorClass.MID,
        }),
      ),
    ).toBe('전용 39.6㎡ · 중/4층');
  });

  it('land shows the lot area only', () => {
    expect(
      specLine(row({ assetType: AssetType.LAND, landArea: 1322, floor: 1, totalFloors: 1 })),
    ).toBe('대지 1,322㎡');
    expect(specLine(row({ assetType: AssetType.LAND }))).toBe('');
  });
});

describe('row labels', () => {
  it('joins the complex name and 동, and adds deal + price for dialogs', () => {
    expect(rowTitle(row({}))).toBe('신대 레이크파크 1단지 103동');
    expect(rowTitle(row({ name: '석현동 해오름빌', dong: null }))).toBe('석현동 해오름빌');
    expect(rowLabel(row({ salePrice: 44500 }))).toBe(
      '신대 레이크파크 1단지 103동 · 매매 4억 4,500',
    );
  });
});
