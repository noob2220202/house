import { describe, expect, it } from 'vitest';
import { agencyListingSchema, type AgencyListing } from '../api/schemas';
import {
  agencyTagline,
  directionsUrl,
  displayPhone,
  formatResponseTime,
  fullAddress,
  listingMeta,
  listingPriceText,
  shortAddress,
  shortAgencyName,
  specialtyLabel,
  telHref,
  listingTitle,
  toListingCard,
} from '../lib/agency';

const listing = (over: Partial<AgencyListing>): AgencyListing =>
  agencyListingSchema.parse({
    id: 'l1',
    assetType: 'APT',
    dealType: 'SALE',
    complexName: '조례 호수마을',
    agencyCount: 1,
    ...over,
  });

describe('office names', () => {
  it('strips the legal suffix for markers and avatars', () => {
    expect(shortAgencyName('호수공원 공인중개사사무소')).toBe('호수공원');
    expect(shortAgencyName('한솔 부동산중개')).toBe('한솔');
    expect(shortAgencyName('선월 분양권 공인중개사 사무소')).toBe('선월 분양권');
    expect(shortAgencyName('공인중개사사무소')).toBe('공인중개사사무소'); // nothing left → keep
  });
});

describe('specialty / tagline', () => {
  it('derives a tagline from specialties when the office has none', () => {
    expect(specialtyLabel(['APT'])).toBe('아파트 전문');
    expect(specialtyLabel(['ONEROOM', 'OFFICETEL', 'LAND'])).toBe('원룸·투룸·오피스텔 전문');
    expect(specialtyLabel([])).toBeNull();
    expect(agencyTagline({ tagline: ' 연향·조례 아파트 전문 ', specialties: ['APT'] })).toBe(
      '연향·조례 아파트 전문',
    );
    expect(agencyTagline({ tagline: null, specialties: ['COMMERCIAL'] })).toBe('상가 전문');
  });
});

describe('address / phone', () => {
  const a = {
    roadAddress: '전라남도 순천시 조례동 호수공원길 24',
    addressDetail: '1층',
    name: 'x',
  };
  it('formats addresses with and without the city', () => {
    expect(fullAddress(a)).toBe('순천시 조례동 호수공원길 24, 1층');
    expect(shortAddress(a)).toBe('조례동 호수공원길 24, 1층');
    expect(fullAddress({ roadAddress: '순천시 연향동 연향3로 41', addressDetail: null })).toBe(
      '순천시 연향동 연향3로 41',
    );
  });
  it('links directions to a map search of the road address', () => {
    expect(directionsUrl(a)).toBe(
      `https://map.kakao.com/link/search/${encodeURIComponent('전라남도 순천시 조례동 호수공원길 24')}`,
    );
  });
  it('builds tel links only for dialable numbers', () => {
    expect(telHref('061-000-0000')).toBe('tel:0610000000');
    expect(telHref('')).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref('문의')).toBeNull();
    expect(displayPhone('0610000000')).toBe('061-000-0000');
  });
});

describe('listing helpers', () => {
  it('formats the headline price per deal type', () => {
    expect(listingPriceText(listing({ salePrice: 30500 }))).toBe('3억 500');
    expect(listingPriceText(listing({ dealType: 'JEONSE', deposit: 24000 }))).toBe('2억 4,000');
    expect(listingPriceText(listing({ dealType: 'MONTHLY', deposit: 2000, monthlyRent: 65 }))).toBe(
      '2,000/65',
    );
    // 분양권 = 분양가 + 프리미엄 (negative premium too)
    expect(
      listingPriceText(listing({ dealType: 'PRESALE', presalePrice: 39200, premium: 2700 })),
    ).toBe('4억 1,900');
    expect(
      listingPriceText(listing({ dealType: 'PRESALE', presalePrice: 35000, premium: -1200 })),
    ).toBe('3억 3,800');
    expect(listingPriceText(listing({}))).toBe('가격 협의');
  });
  it('builds 면적(㎡, 평 alongside) · 층 · 향 meta', () => {
    expect(
      listingMeta(
        listing({ supplyArea: 105.79, totalFloors: 18, floorClass: 'HIGH', direction: 'SOUTH' }),
      ),
    ).toEqual(['공급 106㎡(32평)', '고/18층', '남향']);
    expect(
      listingMeta(
        listing({ assetType: 'ONEROOM', exclusiveArea: 33.06, floor: 3, totalFloors: 4 }),
      ),
    ).toEqual(['전용 33㎡(10평)', '3/4층']);
    // The API sends the class along with a published floor: the floor wins, as on every card.
    expect(
      listingMeta(listing({ supplyArea: 105.79, floor: 11, totalFloors: 13, floorClass: 'HIGH' })),
    ).toEqual(['공급 106㎡(32평)', '11/13층']);
    expect(listingMeta(listing({ assetType: 'LAND', landArea: 502.48 }))).toEqual(['502㎡(152평)']);
  });
  it('maps a listing to ListingCard props', () => {
    const card = toListingCard(
      listing({
        dealType: 'PRESALE',
        presalePrice: 39200,
        premium: 2700,
        dong: '205동',
        verifiedAt: '2026-11-22',
        agencyCount: 2,
      }),
    );
    expect(card).toMatchObject({
      deal: 'presale',
      price: '4억 1,900',
      premium: 2700,
      subtitle: '205동',
      verifiedDate: '26.11.22',
      brokerCount: 2,
      placeholder: 'tower',
    });
    const solo = toListingCard(listing({ assetType: 'LAND', salePrice: 68000, premium: 100 }));
    expect(solo.brokerCount).toBeUndefined();
    expect(solo.premium).toBeUndefined(); // premium only on 분양권
    expect(solo.verifiedDate).toBeUndefined();
    expect(solo.placeholder).toBe('land');
  });
  it('titles a listing like the map list (단지 → 건물 → headline → kind → 동 + 종류)', () => {
    const base = listing({ title: null, complexName: null });
    expect(listingTitle({ ...base, complexName: '조례 호수마을', title: '급매' })).toBe(
      '조례 호수마을',
    );
    expect(listingTitle({ ...base, buildingName: '해오름빌', title: '급매' })).toBe('해오름빌');
    expect(listingTitle({ ...base, title: '조례동 단독주택' })).toBe('조례동 단독주택');
    expect(listingTitle({ ...base, kindLabel: '대지' })).toBe('대지');
    expect(listingTitle({ ...base, emdName: '해룡면' })).toBe('해룡면 아파트');
    expect(listingTitle(base)).toBe('아파트');
  });
  it('formats response time', () => {
    expect(formatResponseTime(8)).toBe('8분');
    expect(formatResponseTime(60)).toBe('1시간');
    expect(formatResponseTime(80)).toBe('1시간 20분');
    expect(formatResponseTime(0.2)).toBe('1분');
  });
});
