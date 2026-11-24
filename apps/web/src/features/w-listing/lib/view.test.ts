import { describe, expect, it } from 'vitest';
import { listingDetailSchema, type ListingDetail } from '../api/schemas';
import { calcPreviews } from './calcPreview';
import {
  addressLine,
  areaLabel,
  buildBreadcrumb,
  buildDisclosure,
  disclosureLocation,
  buildFacts,
  buildVerifySteps,
  descriptionParagraphs,
  floorText,
  headlineAmount,
  headlinePrice,
  listingFullTitle,
  listingNo,
  listingSubtitle,
  mapHref,
  metaDescription,
  priceLabel,
  pricePerPyeong,
  summaryMeta,
} from './view';

/** L01 of mockdata.md as the API would send it (Decimal columns as strings on purpose). */
const RAW = {
  id: '11111111-0000-4000-8000-000000000001',
  listingNo: '26-0412',
  status: 'ACTIVE',
  dealType: 'SALE',
  assetType: 'APT',
  title: '신대 레이크파크 1단지 103동',
  description: '첫 줄 리드입니다.\n\n둘째 문단.\n셋째 문단.',
  salePrice: 44500,
  maintenanceFeeWon: 240000,
  maintenanceFeeItems: ['일반관리비', '청소비'],
  moveInType: 'DATE',
  moveInDate: '2027-02-01',
  floorDisplay: 'CLASS',
  floorClass: 'HIGH',
  options: ['AIR_CONDITIONER'],
  publishedAt: '2026-11-20T09:20:00+09:00',
  verifiedAt: '2026-11-22T14:05:00+09:00',
  viewCount: 312,
  favoriteCount: 128,
  property: {
    roadAddress: '순천시 해룡면 신대1로 30',
    dong: '103동',
    emdName: '해룡면 신대리',
    lat: 34.9215,
    lng: 127.58,
    floor: null,
    totalFloors: 25,
    exclusiveArea: '84.98',
    supplyArea: '112.40',
    areaTypeId: 'area-34',
    rooms: 3,
    baths: 2,
    direction: 'SOUTH',
    directionBasis: 'LIVING_ROOM',
    approvalDate: '2019-06-28',
    parkingSpaces: 1949,
    heatingType: '개별난방 (도시가스)',
  },
  complex: {
    id: 'complex-1',
    name: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    households: 1412,
    builtYear: 2019,
    approvalDate: '2019-06-28',
    parkingPerHousehold: '1.38',
    avgPricePerPyeong: 1180,
    areaTypes: [
      { id: 'area-34', exclusiveArea: '84.98', supplyArea: '112.40', pyeongLabel: '34평' },
    ],
    latestTrade: { price: 43500, dealDate: '2026-10-14', floor: 17, pyeongLabel: '34평' },
  },
  verifications: [
    { method: 'REGISTRY', verifiedAt: '2026-11-19T10:00:00+09:00', note: '소유자 · 면적 일치' },
    { method: 'SITE_VISIT', verifiedAt: '2026-11-20T10:00:00+09:00', note: '사진 14장' },
  ],
  agencies: [
    {
      agencyId: 'a1',
      isPrimary: true,
      name: '신대중앙 공인중개사사무소',
      representativeName: '김서진',
      registrationNumber: '46150-2019-00012',
      phone: '0610000000',
      roadAddress: '순천시 해룡면 신대1로 18',
    },
    {
      agencyId: 'a2',
      name: '호수공원 공인중개사사무소',
      representativeName: '한서윤',
      registrationNumber: '46150-2017-00034',
      phone: '0610000000',
      roadAddress: '순천시 조례동 호수공원길 24',
    },
  ],
};

const make = (
  patch: Record<string, unknown> = {},
  property: Record<string, unknown> = {},
): ListingDetail =>
  listingDetailSchema.parse({ ...RAW, ...patch, property: { ...RAW.property, ...property } });

describe('listing detail schema', () => {
  it('coerces Decimal strings and fills defaults', () => {
    const l = make();
    expect(l.property.exclusiveArea).toBe(84.98);
    expect(l.complex?.parkingPerHousehold).toBe(1.38);
    expect(l.photos).toEqual([]);
    expect(l.nearby).toEqual([]);
    expect(l.agencies[1]?.isPrimary).toBe(false);
  });
});

describe('price helpers', () => {
  it('formats a sale price with its unit and 평당가 from the supply area', () => {
    const l = make();
    expect(headlinePrice(l)).toMatchObject({
      kind: 'sale',
      label: '매매가',
      text: '4억 4,500',
      unit: '만원',
    });
    expect(priceLabel(l)).toBe('매매 4억 4,500');
    expect(pricePerPyeong(l)).toBe(1309);
  });

  it('uses 원 for round 억 amounts and hides the unit for undisclosed prices', () => {
    expect(headlinePrice(make({ salePrice: 30000 }))).toMatchObject({ text: '3억', unit: '원' });
    expect(headlinePrice(make({ salePrice: null }))).toMatchObject({ text: '가격 협의', unit: '' });
  });

  it('handles 전세, 월세 and 분양권', () => {
    const jeonse = make({ dealType: 'JEONSE', salePrice: null, deposit: 24000 });
    expect(headlinePrice(jeonse)).toMatchObject({
      kind: 'jeonse',
      label: '전세가',
      text: '2억 4,000',
    });
    expect(pricePerPyeong(jeonse)).toBeNull();

    const monthly = make({ dealType: 'MONTHLY', salePrice: null, deposit: 2000, monthlyRent: 65 });
    expect(headlinePrice(monthly)).toMatchObject({
      kind: 'monthly',
      text: '2,000/65',
      unit: '만원',
    });
    expect(headlineAmount(monthly)).toBe(2000);

    const presale = make({
      dealType: 'PRESALE',
      salePrice: null,
      presalePrice: 39200,
      premium: 2700,
    });
    expect(headlineAmount(presale)).toBe(41900);
    expect(headlinePrice(presale).note).toBe('분양가 3억 9,200 + 프리미엄 2,700');
    expect(
      headlinePrice(
        make({ dealType: 'PRESALE', salePrice: null, presalePrice: 35000, premium: -1200 }),
      ).note,
    ).toBe('분양가 3억 5,000 − 프리미엄 1,200');
  });
});

describe('title and address', () => {
  it('builds the heading pieces', () => {
    const l = make();
    expect(listingSubtitle(l)).toBe('103동 · 고/25층');
    expect(listingFullTitle(l)).toBe('신대 레이크파크 1단지 103동 매매 4억 4,500');
    expect(addressLine(l)).toBe('순천시 해룡면 신대리 · 1,412세대 · 2019년 6월 준공');
    expect(addressLine(l, true)).toBe('해룡면 신대리 · 1,412세대 · 2019년 준공');
    // 계량법: the legal unit (㎡) of the 전용면적, 평 alongside.
    expect(areaLabel(l)).toBe('전용 84.98㎡ (25.7평)');
    expect(listingNo(l)).toBe('26-0412');
    expect(listingNo({ id: 'abcdef12-3456', listingNo: null })).toBe('ABCDEF12');
  });

  it('shows the exact floor only when the broker allows it', () => {
    expect(floorText(make())).toBe('고/25층');
    expect(floorText(make({ floorDisplay: 'EXACT' }, { floor: 3, totalFloors: 4 }))).toBe('3/4층');
    // CLASS display never leaks an exact floor even if one is present
    expect(floorText(make({}, { floor: 22 }))).toBe('고/25층');
  });

  it('falls back to the labelled 공급면적 without a 전용면적', () => {
    const l = make({ complex: null }, { areaTypeId: null, supplyArea: 52.3, exclusiveArea: null });
    expect(areaLabel(l)).toBe('공급 52.3㎡ (15.8평)');
  });
});

describe('facts and 표시·광고 명시사항', () => {
  it('lists the eight headline facts for an apartment', () => {
    const facts = buildFacts(make(), 'sqm');
    expect(facts.map((f) => f.key)).toEqual([
      'area',
      'rooms',
      'direction',
      'floor',
      'movein',
      'fee',
      'parking',
      'heating',
    ]);
    expect(facts[0]).toMatchObject({
      value: '84.98㎡',
      valueTail: '/ 112.4㎡',
      sub: '25.7평 / 34평',
    });
    expect(buildFacts(make(), 'pyeong')[0]).toMatchObject({ value: '25.7평', valueTail: '/ 34평' });
    // Mobile cell: one figure, the supply area moves to the sub line.
    expect(facts[0]?.compact).toEqual({ label: '전용면적', sub: '공급 112.4㎡' });
    expect(buildFacts(make(), 'pyeong')[0]?.compact).toEqual({
      label: '전용면적',
      sub: '공급 34평',
    });
    const exclusiveOnly = buildFacts(make({}, { supplyArea: null }), 'sqm')[0];
    expect(exclusiveOnly).toMatchObject({ label: '전용면적', value: '84.98㎡', sub: '25.7평' });
    expect(exclusiveOnly?.valueTail).toBeUndefined();
    expect(exclusiveOnly?.compact).toBeUndefined();
    expect(facts.find((f) => f.key === 'fee')?.value).toBe('월 24만원');
    expect(facts.find((f) => f.key === 'parking')?.value).toBe('세대당 1.38대');
    expect(facts.find((f) => f.key === 'heating')).toMatchObject({
      value: '개별난방',
      sub: '도시가스',
    });
  });

  it('includes every mandatory disclosure item, even when a value is missing', () => {
    const rows = buildDisclosure(make({ maintenanceFeeWon: null }, { parkingSpaces: null }));
    expect(rows.map((r) => r.label)).toEqual([
      '소재지',
      '중개대상물 종류',
      '거래 형태',
      '거래 금액',
      '면적',
      '총 층수',
      '해당 층',
      '사용승인일',
      '방향',
      '방 · 욕실 수',
      '입주가능일',
      '주차대수',
      '관리비',
    ]);
    const get = (label: string) => rows.find((r) => r.label === label)?.value;
    expect(get('소재지')).toBe('순천시 해룡면 신대1로 30 신대 레이크파크 1단지 103동');
    expect(get('거래 금액')).toBe('4억 4,500만원');
    expect(get('해당 층')).toBe('고층 (저·중·고 표시)');
    expect(get('방향')).toBe('남향 (거실 기준)');
    expect(get('사용승인일')).toBe('2019.06.28');
    expect(get('주차대수')).toBe('확인 필요');
    expect(get('관리비')).toBe('확인 필요');
  });

  it('writes 소재지 down to the 지번 without repeating words', () => {
    const room = make(
      { assetType: 'ONEROOM', complex: null },
      {
        roadAddress: '전라남도 순천시 석현동 중앙로 12',
        jibunAddress: null,
        buildingName: '석현동 해오름빌',
        dong: null,
      },
    );
    expect(disclosureLocation(room)).toBe('순천시 석현동 중앙로 12 해오름빌');
    const withJibun = make({}, { jibunAddress: '전라남도 순천시 해룡면 신대리 1000' });
    expect(disclosureLocation(withJibun)).toBe(
      '순천시 해룡면 신대리 1000 신대 레이크파크 1단지 103동',
    );
  });

  it('spells out 보증금 and 월세 in the 거래 금액 row', () => {
    const get = (l: ListingDetail) =>
      buildDisclosure(l).find((r) => r.label === '거래 금액')?.value;
    expect(
      get(make({ dealType: 'MONTHLY', salePrice: null, deposit: 2000, monthlyRent: 65 })),
    ).toBe('보증금 2,000만원 / 월세 65만원');
    expect(
      get(make({ dealType: 'MONTHLY', salePrice: null, deposit: 10000, monthlyRent: 30 })),
    ).toBe('보증금 1억원 / 월세 30만원');
  });

  it('uses the land item set for 토지', () => {
    const land = make(
      { assetType: 'LAND', complex: null, salePrice: 18500 },
      {
        exclusiveArea: null,
        supplyArea: null,
        landArea: 512,
        zoning: '제2종일반주거지역',
        landCategory: '대',
        rooms: null,
        baths: null,
        direction: null,
        totalFloors: null,
        heatingType: null,
      },
    );
    expect(buildDisclosure(land).map((r) => r.label)).toEqual([
      '소재지',
      '중개대상물 종류',
      '거래 형태',
      '거래 금액',
      '면적',
      '지목',
      '용도지역',
    ]);
    expect(buildFacts(land, 'sqm').map((f) => f.key)).toEqual(['land', 'zoning', 'category']);
  });

  it('describes the verification steps', () => {
    expect(buildVerifySteps(make())).toEqual([
      expect.objectContaining({
        title: '등기부등본 대조',
        shortTitle: '등기부 대조',
        sub: '소유자 · 면적 일치 · 26.11.19',
      }),
      expect.objectContaining({ title: '현장 방문 · 사진 촬영', sub: '사진 14장 · 26.11.20' }),
    ]);
  });
});

describe('navigation, SEO and misc', () => {
  it('builds the breadcrumb and map link', () => {
    const l = make();
    expect(buildBreadcrumb(l).map((c) => c.label)).toEqual([
      '홈',
      '아파트·분양권',
      '해룡면 신대리',
      '신대 레이크파크 1단지',
      '103동 매매',
    ]);
    expect(mapHref(l)).toBe('/map/apt?c=34.92150,127.58000&z=16');
    expect(buildBreadcrumb(make({ assetType: 'ONEROOM', complex: null }))[1]).toMatchObject({
      label: '원룸·투룸',
      href: '/map/oneroom',
    });
  });

  it('writes a meta description within 160 characters', () => {
    const d = metaDescription(make());
    expect(d).toContain('순천시 해룡면 신대리');
    expect(d).toContain('아파트 매매 4억 4,500');
    expect(d).toContain('전용 84.98㎡ (25.7평)');
    expect(d).toContain('실매물 확인 26.11.22');
    expect(d).toContain('중개사무소 2곳 공동중개');
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it('splits the description into paragraphs', () => {
    expect(descriptionParagraphs(make().description)).toEqual([
      '첫 줄 리드입니다.',
      '둘째 문단.',
      '셋째 문단.',
    ]);
    expect(descriptionParagraphs(null)).toEqual([]);
  });

  it('summarises a card', () => {
    expect(
      summaryMeta({
        supplyArea: 112.4,
        exclusiveArea: 84.98,
        floor: null,
        totalFloors: 25,
        floorClass: 'MID',
        direction: 'SOUTH_EAST',
      }),
    ).toEqual(['전용 85㎡(26평)', '중/25층', '남동향']);
    expect(summaryMeta({ exclusiveArea: 39.6, floor: 3, totalFloors: 4 })).toEqual([
      '전용 40㎡(12평)',
      '3/4층',
    ]);
    expect(summaryMeta({ supplyArea: 52.3, floor: 1, totalFloors: 2 })).toEqual([
      '공급 52㎡(16평)',
      '1/2층',
    ]);
  });

  it('previews the calculators with the design numbers', () => {
    expect(calcPreviews(make())).toEqual([
      {
        tab: 'loan',
        label: '대출 이자',
        value: '월 약 152만원',
        note: '3억 1,150 대출 · 연 4.2% · 30년',
      },
      { tab: 'fee', label: '중개보수', value: '최대 178만원', note: '상한요율 0.4% · 부가세 별도' },
      { tab: 'tax', label: '취득세', value: '약 490만원', note: '1주택 1.1% · 지방교육세 포함' },
    ]);
    const monthly = calcPreviews(
      make({ dealType: 'MONTHLY', salePrice: null, deposit: 2000, monthlyRent: 65 }),
    );
    expect(monthly.map((r) => r.tab)).toEqual(['fee']);
  });
});
