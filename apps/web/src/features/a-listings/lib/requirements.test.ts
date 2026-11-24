import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  FloorDisplay,
  MoveInType,
} from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { DraftPayload } from './form';
import {
  mapServerFieldErrors,
  missingRequirements,
  needsFeeItems,
  publishRequirements,
  requirementProgress,
} from './requirements';

/** A publishable 아파트 매매 draft. */
const APT: DraftPayload = {
  dealType: DealType.SALE,
  salePrice: 44500,
  maintenanceFeeWon: 185_000,
  moveInType: MoveInType.NEGOTIABLE,
  floorDisplay: FloorDisplay.CLASS,
  options: [],
  property: {
    assetType: AssetType.APT,
    complexId: 'c1',
    roadAddress: '전라남도 순천시 해룡면 신대1로 30',
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

const missingLabels = (d: DraftPayload) => missingRequirements(d).map((r) => r.label);

describe('publishRequirements (공인중개사법 제18조의2 명시사항)', () => {
  it('a complete 아파트 매매 draft has nothing missing', () => {
    const reqs = publishRequirements(APT);
    expect(reqs.map((r) => r.label)).toEqual([
      '중개대상물 종류',
      '소재지',
      '해당 층',
      '총 층수',
      '거래 형태',
      '가격 (매매가)',
      '관리비',
      '입주가능일',
      '면적 (전용면적)',
      '방 수',
      '욕실 수',
      '방향',
      '방향 기준',
      '사용승인일',
      '주차대수',
    ]);
    expect(missingRequirements(APT)).toEqual([]);
    expect(requirementProgress(reqs)).toEqual({ done: 15, total: 15 });
  });

  it('an empty draft lists every item with its wizard step and field', () => {
    const empty: DraftPayload = {
      dealType: DealType.SALE,
      floorDisplay: FloorDisplay.EXACT,
      options: [],
      property: { assetType: AssetType.APT },
    };
    const missing = missingRequirements(empty);
    expect(missing.map((r) => r.label)).not.toContain('거래 형태');
    expect(missing.find((r) => r.field === 'property.roadAddress')).toMatchObject({
      formField: 'roadAddress',
      step: 0,
      message: '단지를 검색해서 선택해 주세요.',
    });
    expect(missing.find((r) => r.field === 'salePrice')).toMatchObject({ step: 1 });
    expect(missing.find((r) => r.field === 'maintenanceFeeWon')).toMatchObject({
      formField: 'maintenanceFee',
      step: 1,
    });
    expect(missing.find((r) => r.field === 'property.directionBasis')).toMatchObject({ step: 2 });
  });

  it('소재지 needs the map position, not only the address', () => {
    expect(missingLabels(draft({}, { lat: undefined, lng: undefined }))).toEqual(['소재지']);
  });

  it('price rules per deal type', () => {
    expect(missingLabels(draft({ salePrice: 0 }))).toEqual(['가격 (매매가)']);
    expect(missingLabels(draft({ dealType: DealType.JEONSE, salePrice: undefined }))).toEqual([
      '가격 (전세 보증금)',
    ]);
    // 월세: 보증금 0 is a valid answer, 월세 0 is not.
    expect(
      missingLabels(draft({ dealType: DealType.MONTHLY, deposit: 0, monthlyRent: 45 })),
    ).toEqual([]);
    expect(missingLabels(draft({ dealType: DealType.MONTHLY, deposit: 500 }))).toEqual([
      '가격 (월세)',
    ]);
    // 분양권: 프리미엄 0 (무피) and negative premiums are valid.
    expect(
      missingLabels(draft({ dealType: DealType.PRESALE, presalePrice: 39200, premium: 0 })),
    ).not.toContain('가격 (프리미엄)');
    expect(missingLabels(draft({ dealType: DealType.PRESALE, presalePrice: 39200 }))).toContain(
      '가격 (프리미엄)',
    );
  });

  it('분양권 (미준공) does not ask for the 사용승인일', () => {
    const presale = draft(
      { dealType: DealType.PRESALE, presalePrice: 39200, premium: 2700 },
      { approvalDate: undefined },
    );
    expect(missingRequirements(presale)).toEqual([]);
    expect(missingLabels(draft({}, { approvalDate: undefined }))).toEqual(['사용승인일']);
  });

  it('관리비 0원 (없음) counts as entered; 날짜지정 needs the date', () => {
    expect(missingLabels(draft({ maintenanceFeeWon: 0 }))).toEqual([]);
    expect(missingLabels(draft({ maintenanceFeeWon: undefined }))).toEqual(['관리비']);
    expect(missingLabels(draft({ moveInType: MoveInType.DATE }))).toEqual(['입주가능일']);
    expect(missingLabels(draft({ moveInType: MoveInType.DATE, moveInDate: '2027-02-01' }))).toEqual(
      [],
    );
  });

  it('주차 0대 counts as entered', () => {
    expect(missingLabels(draft({}, { parkingSpaces: 0 }))).toEqual([]);
  });

  it('토지 only needs 종류·소재지·거래·가격·대지면적', () => {
    const land: DraftPayload = {
      dealType: DealType.SALE,
      salePrice: 28000,
      floorDisplay: FloorDisplay.EXACT,
      options: [],
      property: {
        assetType: AssetType.LAND,
        roadAddress: '전라남도 순천시 해룡면 신대리 2011',
        lat: 34.93,
        lng: 127.55,
        landArea: 1322,
      },
    };
    expect(publishRequirements(land).map((r) => r.label)).toEqual([
      '중개대상물 종류',
      '소재지',
      '거래 형태',
      '가격 (매매가)',
      '면적 (대지면적)',
    ]);
    expect(missingRequirements(land)).toEqual([]);
    expect(missingLabels({ ...land, property: { ...land.property, landArea: undefined } })).toEqual(
      ['면적 (대지면적)'],
    );
  });

  it('단독주택 skips 해당 층; 상업·업무 skips 방·욕실 수', () => {
    const house = publishRequirements(draft({}, { assetType: AssetType.HOUSE })).map(
      (r) => r.label,
    );
    expect(house).not.toContain('해당 층');
    expect(house).toContain('총 층수');
    expect(house).toContain('방 수');

    const shop = publishRequirements(draft({}, { assetType: AssetType.COMMERCIAL })).map(
      (r) => r.label,
    );
    expect(shop).toContain('해당 층');
    expect(shop).not.toContain('방 수');
    expect(shop).not.toContain('욕실 수');
    expect(shop).toContain('방향 기준');
  });
});

describe('관리비 포함 항목 (월 10만원 이상 정액 관리비)', () => {
  /** A publishable 원룸·투룸 월세 draft with the given 관리비 (원) and items. */
  const oneroom = (fee: number, items?: string[]) =>
    draft(
      {
        dealType: DealType.MONTHLY,
        deposit: 500,
        monthlyRent: 42,
        salePrice: undefined,
        maintenanceFeeWon: fee,
        maintenanceFeeItems: items,
      },
      { assetType: AssetType.ONEROOM, complexId: undefined },
    );

  it('원룸·오피스텔·주택: 10만원 이상이면 포함 항목이 명시사항', () => {
    expect(needsFeeItems(AssetType.ONEROOM, 100_000)).toBe(true);
    expect(needsFeeItems(AssetType.OFFICETEL, 150_000)).toBe(true);
    expect(needsFeeItems(AssetType.HOUSE, 120_000)).toBe(true);
    expect(missingLabels(oneroom(120_000))).toEqual(['관리비 포함 항목']);
    const item = missingRequirements(oneroom(120_000))[0];
    expect(item).toMatchObject({
      field: 'maintenanceFeeItems',
      formField: 'maintenanceFeeItems',
      step: 1,
    });
    expect(missingLabels(oneroom(120_000, ['일반관리비', '수도료']))).toEqual([]);
  });

  it('10만원 미만 · 관리비 없음 · 아파트 · 상가는 포함 항목을 묻지 않아요', () => {
    expect(missingLabels(oneroom(99_000))).toEqual([]);
    expect(missingLabels(oneroom(0))).toEqual([]);
    expect(needsFeeItems(AssetType.APT, 300_000)).toBe(false);
    expect(needsFeeItems(AssetType.COMMERCIAL, 300_000)).toBe(false);
    expect(needsFeeItems(AssetType.ONEROOM, undefined)).toBe(false);
    expect(missingLabels(APT)).toEqual([]);
  });
});

describe('mapServerFieldErrors', () => {
  it('maps the publish validator details to wizard fields, ordered by step', () => {
    const { errors, unmapped } = mapServerFieldErrors([
      { field: 'property.direction', label: '방향' },
      { field: 'maintenanceFeeWon', label: '관리비' },
      { field: 'property.totalFloors', label: '총 층수' },
    ]);
    expect(unmapped).toEqual([]);
    expect(errors).toEqual([
      { formField: 'totalFloors', step: 0, message: '총 층수 항목을 입력해 주세요.' },
      { formField: 'maintenanceFee', step: 1, message: '관리비 항목을 입력해 주세요.' },
      { formField: 'direction', step: 2, message: '방향 항목을 입력해 주세요.' },
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
