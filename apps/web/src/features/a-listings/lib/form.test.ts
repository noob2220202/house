import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  BuildingUse,
  FloorDisplay,
  ListingOption,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  listingDraftSchema,
  listingUpdateSchema,
} from '@house/shared';
import { describe, expect, it } from 'vitest';
import { seedListings } from '@/app/mock-api/v1/agency/listings/_fixtures';
import { toView } from '@/app/mock-api/v1/agency/listings/_store';
import {
  FIELD_STEP,
  FORM_DEFAULTS,
  STEPS,
  canSaveDraft,
  dealTypesFor,
  emptyFeeItems,
  draftOfListing,
  formFieldOf,
  formatDigits,
  formatSignedDigits,
  fromListing,
  parseArea,
  parseCount,
  parseFloor,
  parseMaintenanceFee,
  parseMoney,
  parsePremium,
  schemaIssues,
  stepIndexOf,
  toDraftPayload,
  toUpdatePayload,
  withUnit,
  type ListingFormValues,
} from './form';

/** 관리비 rows with the given kinds included (amounts in 원 as typed). */
const feeRows = (included: Partial<Record<MaintenanceFeeKind, string>>) =>
  emptyFeeItems().map((row) =>
    row.kind in included ? { ...row, included: true, amount: included[row.kind] ?? '' } : row,
  );

const form = (patch: Partial<ListingFormValues>): ListingFormValues => ({
  ...FORM_DEFAULTS,
  ...patch,
});

/** A complete 아파트 매매 form (신대 레이크파크 1단지 103동, mockdata.md). */
const APT: ListingFormValues = form({
  assetType: AssetType.APT,
  complexId: '00000000-0000-4000-8000-000000000001',
  complexName: '신대 레이크파크 1단지',
  areaTypeId: '00000000-0000-4000-8000-0000000000a1',
  roadAddress: '전라남도 순천시 해룡면 신대1로 30',
  jibunAddress: '전라남도 순천시 해룡면 신대리 2011',
  buildingName: '신대 레이크파크 1단지',
  dong: '103',
  ho: '1502',
  lat: 34.9321,
  lng: 127.5489,
  emdCode: '1215033028',
  floor: '20',
  totalFloors: '25',
  floorDisplay: FloorDisplay.CLASS,
  dealType: DealType.SALE,
  salePrice: '44,500',
  maintenanceFee: '18.5',
  feeBillingType: MaintenanceFeeBillingType.FIXED,
  feeItems: feeRows({ GENERAL: '165,000', WATER: '20,000' }),
  moveInType: MoveInType.NEGOTIABLE,
  exclusiveArea: '84.98',
  supplyArea: '112.4',
  rooms: '3',
  baths: '2',
  direction: Direction.SOUTH,
  directionBasis: DirectionBasis.LIVING_ROOM,
  approvalDate: '2019-06-28',
  parkingSpaces: '1,949',
  title: '호수공원 조망 34평',
  description: '  남향 고층이에요.  ',
  options: [ListingOption.AIR_CONDITIONER, ListingOption.ELEVATOR],
});

describe('wizard steps', () => {
  it('maps ?step= keys to indexes and falls back to the first step', () => {
    expect(stepIndexOf('property')).toBe(0);
    expect(stepIndexOf('photos')).toBe(3);
    expect(stepIndexOf('preview')).toBe(STEPS.length - 1);
    expect(stepIndexOf('nope')).toBe(0);
    expect(stepIndexOf(null)).toBe(0);
  });

  it('routes every form field to an existing step', () => {
    for (const field of Object.keys(FORM_DEFAULTS) as (keyof ListingFormValues)[]) {
      const step = FIELD_STEP[field];
      expect(step, field).toBeGreaterThanOrEqual(0);
      expect(step, field).toBeLessThan(STEPS.length);
    }
  });
});

describe('dealTypesFor', () => {
  it('offers 분양권 only for 공동주택·오피스텔 and no 전세 for land', () => {
    expect(dealTypesFor(AssetType.APT)).toContain(DealType.PRESALE);
    expect(dealTypesFor(AssetType.OFFICETEL)).toContain(DealType.PRESALE);
    expect(dealTypesFor(AssetType.ONEROOM)).toEqual([
      DealType.SALE,
      DealType.JEONSE,
      DealType.MONTHLY,
    ]);
    expect(dealTypesFor(AssetType.LAND)).toEqual([DealType.SALE, DealType.MONTHLY]);
    expect(dealTypesFor('')).not.toContain(DealType.PRESALE);
  });
});

describe('input parsers', () => {
  it('parseFloor: numbers, basements, blanks and garbage', () => {
    expect(parseFloor('')).toBeUndefined();
    expect(parseFloor(' 20층 ')).toBe(20);
    expect(parseFloor('B1')).toBe(-1);
    expect(parseFloor('지하 2')).toBe(-2);
    expect(parseFloor('-1')).toBe(-1);
    expect(parseFloor('고층')).toBeNull();
    expect(parseFloor('2.5')).toBeNull();
  });

  it('parseCount: non-negative integers with separators', () => {
    expect(parseCount('')).toBeUndefined();
    expect(parseCount('0')).toBe(0);
    expect(parseCount('1,949')).toBe(1949);
    expect(parseCount('-1')).toBeNull();
    expect(parseCount('세 개')).toBeNull();
  });

  it('parseArea: ㎡ with up to two decimals, positive only', () => {
    expect(parseArea('')).toBeUndefined();
    expect(parseArea('84.98')).toBe(84.98);
    expect(parseArea('112.4㎡')).toBe(112.4);
    expect(parseArea('1,322')).toBe(1322);
    expect(parseArea('0')).toBeNull();
    expect(parseArea('84.985')).toBeNull();
    expect(parseArea('넓음')).toBeNull();
  });

  it('parseMoney: 만원 with separators or 억 notation', () => {
    expect(parseMoney('')).toBeUndefined();
    expect(parseMoney('44,500')).toBe(44500);
    expect(parseMoney('4억 2,000')).toBe(42000);
    expect(parseMoney('0')).toBe(0);
  });

  it('parsePremium: keeps the sign (마이너스 프리미엄)', () => {
    expect(parsePremium('')).toBeUndefined();
    expect(parsePremium('2,700')).toBe(2700);
    expect(parsePremium('+2,700')).toBe(2700);
    expect(parsePremium('-1,200')).toBe(-1200);
    expect(parsePremium('−500')).toBe(-500);
    expect(parsePremium('0')).toBe(0);
    // 마이너스를 먼저 고르고 금액을 아직 안 적은 상태는 '미입력'이다.
    expect(parsePremium('-')).toBeUndefined();
    expect(parsePremium('+')).toBeUndefined();
  });

  it('parseMaintenanceFee: 만원 (one decimal) → 원', () => {
    expect(parseMaintenanceFee('')).toBeUndefined();
    expect(parseMaintenanceFee('15')).toBe(150_000);
    expect(parseMaintenanceFee('8.5')).toBe(85_000);
    expect(parseMaintenanceFee('18.5만원')).toBe(185_000);
    expect(parseMaintenanceFee('8.55')).toBeNull();
    expect(parseMaintenanceFee('많음')).toBeNull();
  });

  it('formatDigits / formatSignedDigits: thousands separators while typing', () => {
    expect(formatDigits('44500')).toBe('44,500');
    expect(formatDigits('0044500')).toBe('44,500');
    expect(formatDigits('4억')).toBe('4');
    expect(formatDigits('')).toBe('');
    expect(formatSignedDigits('-1200')).toBe('-1,200');
    expect(formatSignedDigits('1200')).toBe('1,200');
  });

  it('withUnit: stores 동·호 the way the public page prints them', () => {
    expect(withUnit('103', '동')).toBe('103동');
    expect(withUnit('103동', '동')).toBe('103동');
    expect(withUnit(' 15 02 ', '호')).toBe('1502호');
    expect(withUnit('', '호')).toBeUndefined();
  });
});

describe('toDraftPayload', () => {
  it('converts a complete 아파트 매매 form into a payload the shared draft schema accepts', () => {
    const { payload, issues } = toDraftPayload(APT);
    expect(issues).toEqual([]);
    expect(payload).toMatchObject({
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
      title: '호수공원 조망 34평',
      description: '남향 고층이에요.',
      property: {
        assetType: AssetType.APT,
        emdCode: '1215033028',
        dong: '103동',
        ho: '1502호',
        floor: 20,
        totalFloors: 25,
        exclusiveArea: 84.98,
        supplyArea: 112.4,
        rooms: 3,
        baths: 2,
        approvalDate: '2019-06-28',
        parkingSpaces: 1949,
      },
    });
    // Fields of other deal types are never sent.
    expect(payload).not.toHaveProperty('deposit');
    expect(payload).not.toHaveProperty('premium');
    expect(listingDraftSchema.safeParse(payload).success).toBe(true);
    expect(canSaveDraft(payload)).toBe(true);
    expect(schemaIssues(payload)).toEqual([]);
  });

  it('sends only the price fields of the chosen deal type', () => {
    const monthly = toDraftPayload(
      form({ ...APT, dealType: DealType.MONTHLY, deposit: '3,000', monthlyRent: '90' }),
    ).payload;
    expect(monthly).toMatchObject({ deposit: 3000, monthlyRent: 90 });
    expect(monthly.salePrice).toBeUndefined();

    const presale = toDraftPayload(
      form({ ...APT, dealType: DealType.PRESALE, presalePrice: '39,200', premium: '-1,200' }),
    ).payload;
    expect(presale).toMatchObject({ presalePrice: 39200, premium: -1200 });
    expect(presale.salePrice).toBeUndefined();
  });

  it('“관리비 없음” is 0원 without a breakdown', () => {
    const { payload } = toDraftPayload(form({ ...APT, maintenanceNone: true }));
    expect(payload.maintenanceFeeWon).toBe(0);
    expect(payload.maintenanceFee).toBeUndefined();
  });

  it('builds the 관리비 내역 per the shared schema (부과방식, 포함 항목, 금액, 사유)', () => {
    // 실비 정산: included items without amounts.
    const actual = toDraftPayload(
      form({
        ...APT,
        maintenanceFee: '6',
        feeBillingType: MaintenanceFeeBillingType.ACTUAL,
        feeItems: feeRows({ GENERAL: '', INTERNET: '' }),
      }),
    ).payload;
    expect(actual.maintenanceFee).toEqual({
      billingType: MaintenanceFeeBillingType.ACTUAL,
      items: [
        { kind: MaintenanceFeeKind.GENERAL, included: true },
        { kind: MaintenanceFeeKind.INTERNET, included: true },
      ],
    });
    expect(listingDraftSchema.safeParse(actual).success).toBe(true);

    // 확인불가 needs the reason (the shared schema refuses it otherwise) → omitted until written.
    const unknown = form({ ...APT, feeBillingType: MaintenanceFeeBillingType.UNKNOWN });
    expect(toDraftPayload(unknown).payload.maintenanceFee).toBeUndefined();
    const withReason = toDraftPayload({
      ...unknown,
      feeUnavailableReason: ' 임대인 미고지 ',
    }).payload;
    expect(withReason.maintenanceFee).toEqual({
      billingType: MaintenanceFeeBillingType.UNKNOWN,
      items: [],
      unavailableReason: '임대인 미고지',
    });
    expect(listingDraftSchema.safeParse(withReason).success).toBe(true);

    // No 부과방식 yet → no maintenanceFee; a bad amount is a field issue.
    expect(
      toDraftPayload(form({ ...APT, feeBillingType: '' })).payload.maintenanceFee,
    ).toBeUndefined();
    const bad = toDraftPayload(form({ ...APT, feeItems: feeRows({ GENERAL: '12만' }) }));
    expect(bad.issues).toEqual([{ field: 'feeItems', message: expect.any(String) as string }]);
  });

  it('sends 건축물 용도 and the 법정동코드 (8-digit complex codes padded, legacy codes canonical)', () => {
    const room = toDraftPayload(
      form({
        ...APT,
        assetType: AssetType.ONEROOM,
        complexId: '',
        buildingUse: BuildingUse.MULTI_FAMILY_HOUSE,
        emdCode: '46150109',
      }),
    ).payload;
    expect(room.property).toMatchObject({
      buildingUse: BuildingUse.MULTI_FAMILY_HOUSE,
      emdCode: '1215010900',
    });
    expect(
      toDraftPayload(form({ ...APT, emdCode: '12150' })).payload.property.emdCode,
    ).toBeUndefined();
    // Land has no building, so no 건축물 용도.
    const land = toDraftPayload(
      form({ ...APT, assetType: AssetType.LAND, buildingUse: BuildingUse.OFFICE }),
    ).payload;
    expect(land.property.buildingUse).toBeUndefined();
  });

  it('collects 방·욕실 for 상업·업무 too (명시사항 of every building)', () => {
    const shop = toDraftPayload(
      form({ ...APT, assetType: AssetType.COMMERCIAL, complexId: '', rooms: '0', baths: '1' }),
    ).payload;
    expect(shop.property).toMatchObject({ rooms: 0, baths: 1 });
  });

  it('land drops building-only fields and keeps the lot area', () => {
    const { payload, issues } = toDraftPayload(
      form({
        ...APT,
        assetType: AssetType.LAND,
        complexId: '',
        dealType: DealType.JEONSE, // not offered for land → falls back to 매매
        landArea: '1,322',
      }),
    );
    expect(issues).toEqual([]);
    expect(payload.dealType).toBe(DealType.SALE);
    expect(payload.options).toEqual([]);
    expect(payload.maintenanceFeeWon).toBeUndefined();
    expect(payload.moveInType).toBeUndefined();
    expect(payload.property).toMatchObject({ assetType: AssetType.LAND, landArea: 1322 });
    for (const key of ['dong', 'ho', 'floor', 'totalFloors', 'rooms', 'exclusiveArea'] as const) {
      expect(payload.property[key], key).toBeUndefined();
    }
  });

  it('a complex id is only sent for 아파트·오피스텔', () => {
    const room = toDraftPayload(form({ ...APT, assetType: AssetType.ONEROOM })).payload;
    expect(room.property.complexId).toBeUndefined();
    expect(room.property.areaTypeId).toBeUndefined();
  });

  it('reports malformed and inconsistent inputs as field issues (and omits them)', () => {
    const { payload, issues } = toDraftPayload(
      form({
        ...APT,
        floor: '30',
        totalFloors: '25',
        exclusiveArea: '120',
        supplyArea: '112.4',
        salePrice: '비쌈',
        maintenanceFee: '1.234',
        parkingSpaces: '많음',
        approvalDate: '2019-13-45',
      }),
    );
    const fields = issues.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'floor',
        'supplyArea',
        'salePrice',
        'maintenanceFee',
        'parkingSpaces',
        'approvalDate',
      ]),
    );
    expect(payload.salePrice).toBeUndefined();
    expect(payload.property.parkingSpaces).toBeUndefined();
    expect(payload.property.approvalDate).toBeUndefined();
  });

  it('rejects a 0-floor building', () => {
    const { payload, issues } = toDraftPayload(form({ ...APT, totalFloors: '0' }));
    expect(issues.map((i) => i.field)).toContain('totalFloors');
    expect(payload.property.totalFloors).toBeUndefined();
  });

  it('an empty form cannot be stored yet', () => {
    const { payload, issues } = toDraftPayload(FORM_DEFAULTS);
    expect(issues).toEqual([]);
    expect(canSaveDraft(payload)).toBe(false);
    // Nothing to range-check until the draft can be saved.
    expect(schemaIssues(payload)).toEqual([]);
  });

  it('schemaIssues maps shared-schema range errors back to form fields', () => {
    const { payload } = toDraftPayload(form({ ...APT, totalFloors: '999', title: 'x'.repeat(81) }));
    const fields = schemaIssues(payload).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['totalFloors', 'title']));
  });
});

describe('formFieldOf', () => {
  it('maps server paths to wizard fields', () => {
    expect(formFieldOf('property.exclusiveArea')).toBe('exclusiveArea');
    expect(formFieldOf('salePrice')).toBe('salePrice');
    expect(formFieldOf('maintenanceFeeWon')).toBe('maintenanceFee');
    expect(formFieldOf('property.lat')).toBe('roadAddress');
    expect(formFieldOf('price')).toBe('salePrice');
    expect(formFieldOf('agency.registrationNumber')).toBeNull();
  });

  it('resolves the publish validator fields with the draft', () => {
    const monthly = toDraftPayload(form({ ...APT, dealType: DealType.MONTHLY, deposit: '500' }));
    expect(formFieldOf('price', monthly.payload)).toBe('monthlyRent');
    const land = toDraftPayload(form({ ...APT, assetType: AssetType.LAND })).payload;
    expect(formFieldOf('property.area', land)).toBe('landArea');
    expect(formFieldOf('property.area', toDraftPayload(APT).payload)).toBe('exclusiveArea');
    expect(formFieldOf('property.emdCode')).toBe('roadAddress');
    expect(formFieldOf('property.buildingUse')).toBe('buildingUse');
    expect(formFieldOf('moveIn')).toBe('moveInType');
    expect(formFieldOf('maintenanceFee.billingType')).toBe('feeBillingType');
    expect(formFieldOf('maintenanceFee.breakdown')).toBe('feeItems');
  });
});

describe('toUpdatePayload (PATCH: omitted = unchanged, null = cleared)', () => {
  it('nulls every form field the broker emptied and carries the version', () => {
    const { payload } = toDraftPayload(
      form({ ...APT, title: '', dong: '', maintenanceNone: true }),
    );
    const body = toUpdatePayload(payload, 7);
    expect(body).toMatchObject({ title: null, maintenanceFee: null, version: 7 });
    expect(body.property).toMatchObject({ dong: null, landArea: null, emdCode: '1215033028' });
    // Fields the wizard does not manage are left out (unchanged on the server).
    expect(body.property).not.toHaveProperty('totalFloorArea');
    expect(listingUpdateSchema.safeParse(body).success).toBe(true);
    expect(toUpdatePayload(payload)).not.toHaveProperty('version');
  });
});

describe('fromListing ↔ toDraftPayload', () => {
  it('round-trips every seeded listing without losing or inventing data', () => {
    for (const stored of seedListings()) {
      const listing = toView(stored);
      const { payload, issues } = toDraftPayload(fromListing(listing));
      expect(issues, stored.code).toEqual([]);
      const original = draftOfListing(listing);
      // Compare through JSON so `undefined` keys do not matter.
      expect(JSON.parse(JSON.stringify(payload)), stored.code).toEqual(
        JSON.parse(JSON.stringify(original)),
      );
    }
  });

  it('shows basements as B1 and 0원 관리비 as “관리비 없음”', () => {
    const base = toView(seedListings()[0]!);
    const values = fromListing({
      ...base,
      maintenanceFeeWon: 0,
      property: { ...base.property, floor: -1 },
    });
    expect(values.floor).toBe('B1');
    expect(values.maintenanceNone).toBe(true);
    expect(values.maintenanceFee).toBe('');
  });
});
