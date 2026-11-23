import { listingDraftSchema, listingPhotosSchema, listingUpdateSchema } from '../schemas/listings';
import { checkPublishRequirements, type PublishCheckInput } from './publish';
import {
  AGENCY_EDITABLE_STATUSES,
  applicablePrices,
  canAgencyTransition,
  floorClassOf,
  floorLabel,
  priceSortOf,
  searchAreaOf,
} from './rules';

const agency = {
  name: '순천공인중개사사무소',
  roadAddress: '전라남도 순천시 연향로 1',
  phone: '0617491234',
  registrationNumber: '46150-2026-00001',
  representativeName: '홍길동',
};

function complete(overrides: Partial<PublishCheckInput> = {}): PublishCheckInput {
  return {
    dealType: 'SALE',
    salePrice: 35000,
    maintenanceFeeWon: 0,
    moveInType: 'NEGOTIABLE',
    agency,
    ...overrides,
    property: {
      assetType: 'APT',
      roadAddress: '전라남도 순천시 연향로 100',
      emdCode: '4615010400',
      floor: 3,
      totalFloors: 15,
      exclusiveArea: 84.97,
      rooms: 0,
      baths: 0,
      direction: 'SOUTH',
      directionBasis: 'LIVING_ROOM',
      approvalDate: '2015-01-01',
      parkingSpaces: 0,
      ...overrides.property,
    },
  };
}

const fields = (i: PublishCheckInput) => checkPublishRequirements(i).map((x) => x.field);

describe('checkPublishRequirements (표시·광고 명시사항)', () => {
  it('accepts a complete building listing; 0 counts and 0 관리비 are valid values', () => {
    expect(checkPublishRequirements(complete())).toEqual([]);
  });

  it('reports every missing building item with Korean labels', () => {
    const issues = checkPublishRequirements({
      dealType: 'SALE',
      property: { assetType: 'OFFICETEL', roadAddress: ' ' },
      agency: null,
    });
    expect(issues.map((i) => i.label)).toEqual([
      '소재지',
      '소재지(법정동)',
      '면적',
      '가격',
      '총 층수',
      '해당 층',
      '사용승인일',
      '방향',
      '방향 기준',
      '방 수',
      '욕실 수',
      '입주가능일',
      '주차대수',
      '관리비',
      '중개사무소 명칭',
      '중개사무소 소재지',
      '중개사무소 연락처',
      '중개사무소 등록번호',
      '개업공인중개사 성명',
    ]);
  });

  it('토지 needs only 소재지·면적(대지)·가격·종류·거래형태 + agency', () => {
    const land = checkPublishRequirements({
      dealType: 'SALE',
      salePrice: 5000,
      property: {
        assetType: 'LAND',
        roadAddress: '순천시 해룡면 1',
        emdCode: '4615025000',
        landArea: 330,
      },
      agency,
    });
    expect(land).toEqual([]);
    expect(
      fields({
        dealType: 'SALE',
        salePrice: 5000,
        property: { assetType: 'LAND', roadAddress: 'x' },
        agency,
      }),
    ).toEqual(['property.emdCode', 'property.area']);
  });

  it('price rules per deal type', () => {
    expect(fields(complete({ dealType: 'SALE', salePrice: 0 }))).toEqual(['price']);
    expect(fields(complete({ dealType: 'JEONSE', salePrice: null, deposit: 20000 }))).toEqual([]);
    expect(fields(complete({ dealType: 'MONTHLY', deposit: 0, monthlyRent: 40 }))).toEqual([]);
    expect(fields(complete({ dealType: 'MONTHLY', deposit: 500, monthlyRent: null }))).toEqual([
      'price',
    ]);
    expect(fields(complete({ dealType: 'PRESALE', presalePrice: 30000, premium: -500 }))).toEqual(
      [],
    );
    expect(fields(complete({ dealType: 'PRESALE', presalePrice: 30000 }))).toEqual(['price']);
  });

  it('분양권 needs no 사용승인일; 단독주택 needs no 해당 층 but accepts 연면적', () => {
    expect(
      fields(
        complete({
          dealType: 'PRESALE',
          presalePrice: 30000,
          premium: 0,
          property: { assetType: 'APT', approvalDate: null },
        }),
      ),
    ).toEqual([]);
    expect(
      fields(
        complete({
          property: { assetType: 'HOUSE', floor: null, exclusiveArea: null, totalFloorArea: 120 },
        }),
      ),
    ).toEqual([]);
  });

  it('해당 층 must be a real floor of the building (no 0층, ≤ 총 층수, classifiable for 저/중/고)', () => {
    expect(fields(complete({ property: { assetType: 'APT', floor: 0 } }))).toEqual([
      'property.floor',
    ]);
    expect(fields(complete({ property: { assetType: 'APT', floor: 16 } }))).toEqual([
      'property.floor',
    ]);
    expect(fields(complete({ property: { assetType: 'APT', floor: -1 } }))).toEqual([]);
    expect(
      fields(complete({ floorDisplay: 'CLASS', property: { assetType: 'APT', floor: 9 } })),
    ).toEqual([]);
    // 단독주택 may omit 해당 층.
    expect(fields(complete({ property: { assetType: 'HOUSE', floor: null } }))).toEqual([]);
  });

  it('소재지(법정동) is required for every asset type', () => {
    expect(fields(complete({ property: { assetType: 'APT', emdCode: null } }))).toEqual([
      'property.emdCode',
    ]);
  });

  it('입주가능일 DATE requires the date', () => {
    expect(fields(complete({ moveInType: 'DATE' }))).toEqual(['moveIn']);
    expect(fields(complete({ moveInType: 'DATE', moveInDate: '2027-03-01' }))).toEqual([]);
  });
});

describe('listing rules', () => {
  it('floorClassOf', () => {
    expect(floorClassOf(-1, 10)).toBe('LOW');
    expect(floorClassOf(1, 2)).toBe('LOW');
    expect(floorClassOf(2, 2)).toBe('HIGH');
    expect(floorClassOf(5, 15)).toBe('LOW');
    expect(floorClassOf(6, 15)).toBe('MID');
    expect(floorClassOf(10, 15)).toBe('MID');
    expect(floorClassOf(11, 15)).toBe('HIGH');
    expect(floorClassOf(null, 15)).toBeNull();
    expect(floorClassOf(5, null)).toBeNull();
    expect(floorClassOf(20, 15)).toBeNull();
  });

  it('floorLabel', () => {
    expect(floorLabel(5, 15)).toBe('5/15층');
    expect(floorLabel(-1, 3)).toBe('B1/3층');
    expect(floorLabel(12, 20, 'CLASS')).toBe('중/20층');
    expect(floorLabel(null, 20)).toBe('-/20층');
    expect(floorLabel(3, null)).toBe('3층');
    expect(floorLabel(null, null)).toBeNull();
  });

  it('priceSortOf and searchAreaOf', () => {
    expect(priceSortOf('SALE', { salePrice: 30000 })).toBe(30000);
    expect(priceSortOf('PRESALE', { presalePrice: 30000, premium: 2000 })).toBe(32000);
    expect(priceSortOf('PRESALE', { premium: 2000 })).toBeNull();
    expect(priceSortOf('MONTHLY', { deposit: 1000, monthlyRent: 50 })).toBe(1000);
    expect(searchAreaOf({ exclusiveArea: null, totalFloorArea: 99, landArea: 300 })).toBe(99);
    expect(searchAreaOf({})).toBeNull();
  });

  it('applicablePrices keeps only the fields of the deal type', () => {
    const all = { salePrice: 1, deposit: 2, monthlyRent: 3, presalePrice: 4, premium: 5 };
    expect(applicablePrices('SALE', all)).toEqual({
      salePrice: 1,
      deposit: null,
      monthlyRent: null,
      presalePrice: null,
      premium: null,
    });
    expect(applicablePrices('JEONSE', all)).toMatchObject({ deposit: 2, monthlyRent: null });
    expect(applicablePrices('MONTHLY', all)).toMatchObject({
      salePrice: null,
      deposit: 2,
      monthlyRent: 3,
    });
    expect(applicablePrices('PRESALE', all)).toMatchObject({
      salePrice: null,
      presalePrice: 4,
      premium: 5,
    });
  });

  it('hidden listings are not agency-editable', () => {
    expect(AGENCY_EDITABLE_STATUSES).not.toContain('HIDDEN');
  });

  it('agency status transitions', () => {
    expect(canAgencyTransition('ACTIVE', 'RESERVED')).toBe(true);
    expect(canAgencyTransition('RESERVED', 'ACTIVE')).toBe(true);
    expect(canAgencyTransition('CLOSED', 'DRAFT')).toBe(true);
    expect(canAgencyTransition('DRAFT', 'ACTIVE')).toBe(false);
    expect(canAgencyTransition('HIDDEN', 'ACTIVE')).toBe(false);
    expect(canAgencyTransition('CLOSED', 'ACTIVE')).toBe(false);
  });
});

describe('listing write schemas', () => {
  const property = { assetType: 'APT', roadAddress: '순천시 1', lat: 34.95, lng: 127.49 };

  it('draft applies defaults and requires the map position', () => {
    const d = listingDraftSchema.parse({ dealType: 'SALE', property });
    expect(d).toMatchObject({ floorDisplay: 'EXACT', options: [], maintenanceFeeItems: [] });
    expect(
      listingDraftSchema.safeParse({ dealType: 'SALE', property: { assetType: 'APT' } }).success,
    ).toBe(false);
  });

  it('update: null clears optional fields, required ones cannot be cleared, empty patch fails', () => {
    expect(listingUpdateSchema.parse({ salePrice: null, property: { ho: null } })).toMatchObject({
      salePrice: null,
      property: { ho: null },
    });
    expect(listingUpdateSchema.safeParse({ property: { roadAddress: null } }).success).toBe(false);
    expect(listingUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('floor: no 0층 and not above 총 층수 (draft and patch)', () => {
    const p = { ...property, floor: 0, totalFloors: 10 };
    expect(listingDraftSchema.safeParse({ dealType: 'SALE', property: p }).success).toBe(false);
    expect(
      listingDraftSchema.safeParse({ dealType: 'SALE', property: { ...p, floor: 11 } }).success,
    ).toBe(false);
    expect(
      listingDraftSchema.safeParse({ dealType: 'SALE', property: { ...p, floor: -1 } }).success,
    ).toBe(true);
    expect(listingUpdateSchema.safeParse({ property: { floor: 0 } }).success).toBe(false);
    expect(
      listingUpdateSchema.safeParse({ property: { floor: 12, totalFloors: 10 } }).success,
    ).toBe(false);
  });

  it('update: version alone is not a change; contact has no free-text name', () => {
    expect(listingUpdateSchema.safeParse({ version: 3 }).success).toBe(false);
    expect(listingUpdateSchema.parse({ version: 3, title: '새 제목' })).toMatchObject({
      version: 3,
    });
    const c = listingUpdateSchema.parse({
      contact: { contactName: '아무개', contactPhone: '01012345678' },
    });
    expect(c.contact).not.toHaveProperty('contactName');
  });

  it('photos: unique media and a cover from the set', () => {
    const a = '01890000-0000-7000-8000-000000000001';
    const b = '01890000-0000-7000-8000-000000000002';
    expect(
      listingPhotosSchema.safeParse({ photos: [{ mediaId: a }], coverMediaId: a }).success,
    ).toBe(true);
    expect(
      listingPhotosSchema.safeParse({ photos: [{ mediaId: a }, { mediaId: a }] }).success,
    ).toBe(false);
    expect(
      listingPhotosSchema.safeParse({ photos: [{ mediaId: a }], coverMediaId: b }).success,
    ).toBe(false);
  });
});
