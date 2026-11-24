import {
  AssetType,
  BuildingUse,
  DealType,
  Direction,
  DirectionBasis,
  FloorDisplay,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  checkPublishRequirements,
  listingDraftSchema,
} from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  FORM_DEFAULTS,
  emptyFeeItems,
  toDraftPayload,
  type DraftPayload,
  type ListingFormValues,
} from './form';
import {
  agencyIssues,
  mapServerFieldErrors,
  missingRequirements,
  needsFeeAmounts,
  publishRequirements,
  requirementProgress,
  toPublishInput,
  type PublishAgency,
} from './requirements';

const OFFICE: PublishAgency = {
  name: '신대중앙 공인중개사사무소',
  roadAddress: '전남광주통합특별시 순천시 해룡면 신대1로 18',
  phone: '0617220000',
  registrationNumber: '46150-2020-00012',
  representativeName: '김서진',
};

/** A publishable 아파트 매매 draft. */
const APT: DraftPayload = {
  dealType: DealType.SALE,
  salePrice: 44500,
  maintenanceFeeWon: 185_000,
  maintenanceFee: {
    billingType: MaintenanceFeeBillingType.FIXED,
    items: [
      { kind: MaintenanceFeeKind.GENERAL, included: true, amountWon: 165_000 },
      { kind: MaintenanceFeeKind.WATER, included: true, amountWon: 20_000 },
    ],
  },
  moveInType: MoveInType.NEGOTIABLE,
  floorDisplay: FloorDisplay.CLASS,
  options: [],
  property: {
    assetType: AssetType.APT,
    complexId: 'c1',
    roadAddress: '전남광주통합특별시 순천시 해룡면 신대1로 30',
    emdCode: '1215033028',
    lat: 34.9321,
    lng: 127.5489,
    dong: '103동',
    floor: 20,
    totalFloors: 25,
    exclusiveArea: 84.98,
    supplyArea: 112.4,
    rooms: 3,
    baths: 2,
    direction: Direction.SOUTH,
    directionBasis: DirectionBasis.LIVING_ROOM,
    approvalDate: '2019-06-28',
    parkingSpaces: 1949,
  },
};

const draft = (
  patch: Partial<DraftPayload>,
  property: Partial<DraftPayload['property']> = {},
): DraftPayload => ({ ...APT, ...patch, property: { ...APT.property, ...property } });

const missingFields = (d: DraftPayload) => missingRequirements(d).map((r) => r.field);

// ---- D10: wizard form → draft payload → the API's validator ------------------------------------------

const feeRows = (included: Partial<Record<MaintenanceFeeKind, string>>) =>
  emptyFeeItems().map((row) =>
    row.kind in included ? { ...row, included: true, amount: included[row.kind] ?? '' } : row,
  );

/** Building fields every non-land form fills (방향, 사용승인일, 주차, 입주 …). */
const BUILDING: Partial<ListingFormValues> = {
  floor: '3',
  totalFloors: '5',
  floorDisplay: FloorDisplay.EXACT,
  exclusiveArea: '39.6',
  rooms: '2',
  baths: '1',
  direction: Direction.SOUTH,
  directionBasis: DirectionBasis.LIVING_ROOM,
  approvalDate: '2019-04-12',
  parkingSpaces: '4',
  moveInType: MoveInType.IMMEDIATE,
};

/** What the wizard holds once the broker filled in each asset type (address picked → emdCode). */
const FORMS: Record<'apartment' | 'oneroom' | 'house' | 'commercial' | 'land', ListingFormValues> =
  {
    apartment: {
      ...FORM_DEFAULTS,
      ...BUILDING,
      assetType: AssetType.APT,
      complexId: '00000000-0000-4000-8000-000000000001',
      roadAddress: '전남광주통합특별시 순천시 해룡면 신대1로 30',
      lat: 34.9321,
      lng: 127.5489,
      // The complex's 8-digit 읍면동 code (legacy form) → padded and canonicalized.
      emdCode: '46150330',
      floor: '20',
      totalFloors: '25',
      dealType: DealType.SALE,
      salePrice: '44,500',
      maintenanceFee: '18.5',
      feeBillingType: MaintenanceFeeBillingType.FIXED,
      feeItems: feeRows({ GENERAL: '165,000', WATER: '20,000' }),
    },
    oneroom: {
      ...FORM_DEFAULTS,
      ...BUILDING,
      assetType: AssetType.ONEROOM,
      buildingUse: BuildingUse.MULTI_FAMILY_HOUSE,
      roadAddress: '전남광주통합특별시 순천시 대학로 15',
      lat: 34.9689,
      lng: 127.4812,
      emdCode: '1215010900',
      dealType: DealType.MONTHLY,
      deposit: '500',
      monthlyRent: '42',
      maintenanceFee: '5',
      feeBillingType: MaintenanceFeeBillingType.ACTUAL,
      feeItems: feeRows({ WATER: '', INTERNET: '' }),
    },
    house: {
      ...FORM_DEFAULTS,
      ...BUILDING,
      assetType: AssetType.HOUSE,
      buildingUse: BuildingUse.DETACHED_HOUSE,
      roadAddress: '전남광주통합특별시 순천시 서면 선평길 12',
      lat: 34.98,
      lng: 127.45,
      // Kakao postcode bcode in the legacy code space → canonical 12150….
      emdCode: '4615031022',
      floor: '',
      totalFloors: '2',
      landArea: '330',
      dealType: DealType.SALE,
      salePrice: '32,000',
      maintenanceNone: true,
    },
    commercial: {
      ...FORM_DEFAULTS,
      ...BUILDING,
      assetType: AssetType.COMMERCIAL,
      buildingUse: BuildingUse.NEIGHBORHOOD_FACILITY_1,
      roadAddress: '전남광주통합특별시 순천시 연향3로 41',
      lat: 34.95,
      lng: 127.52,
      emdCode: '1215011900',
      floor: '1',
      rooms: '0',
      baths: '1',
      directionBasis: DirectionBasis.ENTRANCE,
      dealType: DealType.MONTHLY,
      deposit: '3,000',
      monthlyRent: '150',
      maintenanceFee: '12',
      feeBillingType: MaintenanceFeeBillingType.UNKNOWN,
      feeUnavailableReason: '임대인이 관리비 내역을 알려주지 않았어요',
    },
    land: {
      ...FORM_DEFAULTS,
      assetType: AssetType.LAND,
      roadAddress: '전남광주통합특별시 순천시 해룡면 신대3길 9',
      jibunAddress: '전남광주통합특별시 순천시 해룡면 신대리 2011',
      lat: 34.9338,
      lng: 127.5532,
      emdCode: '1215033028',
      landArea: '512',
      dealType: DealType.SALE,
      salePrice: '18,500',
    },
  };

describe('D10 — wizard payloads pass the shared publish validator', () => {
  for (const [name, values] of Object.entries(FORMS)) {
    it(`${name}: draft schema + checkPublishRequirements accept the payload`, () => {
      const { payload, issues } = toDraftPayload(values);
      expect(issues).toEqual([]);
      expect(payload.property.emdCode).toMatch(/^12150\d{5}$/);
      expect(listingDraftSchema.safeParse(payload).success).toBe(true);
      expect(checkPublishRequirements(toPublishInput(payload, OFFICE))).toEqual([]);
      // The checklist agrees with the validator.
      expect(missingRequirements(payload)).toEqual([]);
    });
  }

  it('without the 법정동코드 or the 건축물 용도 the validator refuses — and the checklist says so', () => {
    const { payload } = toDraftPayload({ ...FORMS.oneroom, emdCode: '', buildingUse: '' });
    const fields = checkPublishRequirements(toPublishInput(payload, OFFICE)).map((i) => i.field);
    expect(fields).toEqual(['property.emdCode', 'property.buildingUse']);
    expect(missingRequirements(payload)).toMatchObject([
      { field: 'property.emdCode', formField: 'roadAddress', step: 0, label: '소재지(법정동)' },
      {
        field: 'property.buildingUse',
        formField: 'buildingUse',
        step: 0,
        label: '중개대상물 종류(건축물 용도)',
      },
    ]);
  });

  it('아파트·오피스텔 imply the 건축물 용도; the other building types must state it', () => {
    const asked = (assetType: AssetType) =>
      publishRequirements(draft({}, { assetType })).some((r) => r.field === 'property.buildingUse');
    expect(asked(AssetType.APT)).toBe(false);
    expect(asked(AssetType.OFFICETEL)).toBe(false);
    expect(asked(AssetType.ONEROOM)).toBe(true);
    expect(asked(AssetType.HOUSE)).toBe(true);
    expect(asked(AssetType.COMMERCIAL)).toBe(true);
    expect(asked(AssetType.LAND)).toBe(false);
  });
});

// ---- checklist ---------------------------------------------------------------------------------------

describe('publishRequirements (checklist driven by the shared validator)', () => {
  it('a complete 아파트 매매 draft lists every item done, with the shared labels', () => {
    const reqs = publishRequirements(APT);
    expect(reqs.map((r) => r.label)).toEqual([
      '소재지',
      '소재지(법정동)',
      '면적',
      '가격',
      '매물 종류',
      '거래형태',
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
      '관리비 부과방식',
      '관리비 세부내역',
    ]);
    expect(missingRequirements(APT)).toEqual([]);
    expect(requirementProgress(reqs)).toEqual({ done: 18, total: 18 });
  });

  it('items stay in the list once filled (done), and office fields are never listed', () => {
    const empty: DraftPayload = {
      dealType: DealType.SALE,
      floorDisplay: FloorDisplay.EXACT,
      options: [],
      property: { assetType: AssetType.ONEROOM },
    };
    const before = publishRequirements(empty).map((r) => r.field);
    const after = publishRequirements({
      ...empty,
      property: { ...empty.property, buildingUse: BuildingUse.MULTIPLEX_HOUSE },
    });
    expect(after.map((r) => r.field)).toEqual(before);
    expect(after.find((r) => r.field === 'property.buildingUse')?.done).toBe(true);
    expect(before.some((f) => f.startsWith('agency.'))).toBe(false);
  });

  it('an empty draft maps every item to its wizard step and field', () => {
    const empty: DraftPayload = {
      dealType: DealType.SALE,
      floorDisplay: FloorDisplay.EXACT,
      options: [],
      property: { assetType: AssetType.APT },
    };
    const missing = missingRequirements(empty);
    expect(missing.map((r) => r.field)).not.toContain('dealType');
    expect(missing.find((r) => r.field === 'property.roadAddress')).toMatchObject({
      formField: 'roadAddress',
      step: 0,
      message: '단지를 검색해서 선택해 주세요.',
    });
    expect(missing.find((r) => r.field === 'price')).toMatchObject({
      formField: 'salePrice',
      step: 1,
    });
    expect(missing.find((r) => r.field === 'maintenanceFeeWon')).toMatchObject({
      formField: 'maintenanceFee',
      step: 1,
    });
    expect(missing.find((r) => r.field === 'property.area')).toMatchObject({
      formField: 'exclusiveArea',
      step: 2,
    });
    expect(missing.find((r) => r.field === 'property.directionBasis')).toMatchObject({ step: 2 });
  });

  it('price items point at the field that is missing for the deal type', () => {
    expect(missingRequirements(draft({ salePrice: 0 }))).toMatchObject([
      { field: 'price', formField: 'salePrice' },
    ]);
    expect(
      missingRequirements(
        draft({ dealType: DealType.MONTHLY, deposit: 500, salePrice: undefined }),
      ),
    ).toMatchObject([
      { field: 'price', formField: 'monthlyRent', message: '월세를 입력해 주세요.' },
    ]);
    // 월세: 보증금 0 is a valid answer; 분양권: 프리미엄 0 (무피) too.
    expect(
      missingFields(draft({ dealType: DealType.MONTHLY, deposit: 0, monthlyRent: 45 })),
    ).toEqual([]);
    expect(
      missingRequirements(draft({ dealType: DealType.PRESALE, presalePrice: 39200 })),
    ).toMatchObject([{ field: 'price', formField: 'premium' }]);
  });

  it('분양권 (미준공) does not ask for the 사용승인일; 날짜지정 needs the date', () => {
    const presale = draft(
      { dealType: DealType.PRESALE, presalePrice: 39200, premium: 2700 },
      { approvalDate: undefined },
    );
    expect(missingRequirements(presale)).toEqual([]);
    expect(missingFields(draft({}, { approvalDate: undefined }))).toEqual([
      'property.approvalDate',
    ]);
    expect(missingRequirements(draft({ moveInType: MoveInType.DATE }))).toMatchObject([
      { field: 'moveIn', formField: 'moveInDate' },
    ]);
  });

  it('관리비 0원 (없음) and 주차 0대 count as entered', () => {
    expect(missingFields(draft({ maintenanceFeeWon: 0, maintenanceFee: undefined }))).toEqual([]);
    expect(missingFields(draft({}, { parkingSpaces: 0 }))).toEqual([]);
    expect(missingFields(draft({ maintenanceFeeWon: undefined }))).toEqual(['maintenanceFeeWon']);
  });

  it('토지 only needs 소재지·법정동·면적·가격·종류·거래형태', () => {
    const { payload } = toDraftPayload(FORMS.land);
    expect(publishRequirements(payload).map((r) => r.field)).toEqual([
      'property.roadAddress',
      'property.emdCode',
      'property.area',
      'price',
      'property.assetType',
      'dealType',
    ]);
    expect(
      missingRequirements({ ...payload, property: { ...payload.property, landArea: undefined } }),
    ).toMatchObject([{ field: 'property.area', formField: 'landArea' }]);
  });

  it('단독주택 skips 해당 층; 상업·업무 still asks for 방·욕실 수', () => {
    const house = publishRequirements(draft({}, { assetType: AssetType.HOUSE })).map(
      (r) => r.field,
    );
    expect(house).not.toContain('property.floor');
    expect(house).toContain('property.totalFloors');
    const shop = publishRequirements(draft({}, { assetType: AssetType.COMMERCIAL })).map(
      (r) => r.field,
    );
    expect(shop).toEqual(
      expect.arrayContaining(['property.floor', 'property.rooms', 'property.baths']),
    );
  });
});

describe('관리비 세부내역 (세부기준, shared rules)', () => {
  const fee = (won: number, maintenanceFee: DraftPayload['maintenanceFee']) =>
    draft({ maintenanceFeeWon: won, maintenanceFee });

  it('정액 10만원 이상: 항목별 금액이 관리비와 같아야 해요', () => {
    expect(needsFeeAmounts(MaintenanceFeeBillingType.FIXED, 100_000)).toBe(true);
    expect(needsFeeAmounts(MaintenanceFeeBillingType.FIXED, 99_000)).toBe(false);
    expect(needsFeeAmounts(MaintenanceFeeBillingType.ACTUAL, 300_000)).toBe(false);
    const short = fee(185_000, {
      billingType: MaintenanceFeeBillingType.FIXED,
      items: [{ kind: MaintenanceFeeKind.GENERAL, included: true, amountWon: 150_000 }],
    });
    expect(missingRequirements(short)).toMatchObject([
      { field: 'maintenanceFee.breakdown', formField: 'feeItems', step: 1 },
    ]);
    expect(missingRequirements(short)[0]?.message).toContain('항목별 금액');
  });

  it('부과방식이 없으면 부과방식을, 항목이 없으면 세부내역을 물어요', () => {
    expect(missingFields(fee(50_000, undefined))).toEqual(['maintenanceFee.billingType']);
    expect(
      missingFields(fee(50_000, { billingType: MaintenanceFeeBillingType.ACTUAL, items: [] })),
    ).toEqual(['maintenanceFee.breakdown']);
    expect(
      missingFields(
        fee(50_000, {
          billingType: MaintenanceFeeBillingType.ACTUAL,
          items: [{ kind: MaintenanceFeeKind.WATER, included: true }],
        }),
      ),
    ).toEqual([]);
  });

  it('확인불가 + 사유 is enough', () => {
    expect(
      missingFields(
        fee(250_000, {
          billingType: MaintenanceFeeBillingType.UNKNOWN,
          items: [],
          unavailableReason: '임대인 미고지',
        }),
      ),
    ).toEqual([]);
  });
});

describe('agencyIssues (office disclosure)', () => {
  it('reports the empty office fields only', () => {
    expect(agencyIssues(APT, OFFICE)).toEqual([]);
    expect(agencyIssues(APT, { ...OFFICE, phone: '', registrationNumber: null })).toEqual([
      { field: 'agency.phone', label: '중개사무소 연락처' },
      { field: 'agency.registrationNumber', label: '중개사무소 등록번호' },
    ]);
    expect(agencyIssues(APT, null)).toHaveLength(5);
  });
});

describe('mapServerFieldErrors', () => {
  it('maps the publish validator details to wizard fields, ordered by step', () => {
    const { errors, unmapped } = mapServerFieldErrors(
      [
        { field: 'property.direction', label: '방향' },
        { field: 'maintenanceFeeWon', label: '관리비' },
        { field: 'property.emdCode', label: '소재지(법정동)' },
        { field: 'price', label: '가격' },
      ],
      draft({ dealType: DealType.JEONSE }),
    );
    expect(unmapped).toEqual([]);
    expect(errors).toEqual([
      { formField: 'roadAddress', step: 0, message: expect.stringContaining('법정동') as string },
      {
        formField: 'maintenanceFee',
        step: 1,
        message: expect.stringContaining('관리비') as string,
      },
      { formField: 'deposit', step: 1, message: '전세 보증금을 입력해 주세요.' },
      { formField: 'direction', step: 2, message: '방향을 선택해 주세요.' },
    ]);
  });

  it('accepts validation details (path + message) and keeps one error per field', () => {
    const { errors } = mapServerFieldErrors([
      { path: 'property.lat', message: '위도가 올바르지 않습니다.' },
      { path: 'property.lng', message: '경도가 올바르지 않습니다.' },
      { path: 'title', message: '80자 이내로 입력해 주세요.' },
    ]);
    expect(errors).toEqual([
      { formField: 'roadAddress', step: 0, message: '위도가 올바르지 않습니다.' },
      { formField: 'title', step: 4, message: '80자 이내로 입력해 주세요.' },
    ]);
  });

  it('returns fields the wizard does not own (office disclosure) as text', () => {
    const { errors, unmapped } = mapServerFieldErrors([
      { field: 'agency.registrationNumber', label: '중개사무소 등록번호' },
      { field: 'agency.representativeName' },
      {},
    ]);
    expect(errors).toEqual([]);
    expect(unmapped).toEqual(['중개사무소 등록번호', 'agency.representativeName']);
  });

  it('tolerates a missing details array', () => {
    expect(mapServerFieldErrors(undefined)).toEqual({ errors: [], unmapped: [] });
  });
});
