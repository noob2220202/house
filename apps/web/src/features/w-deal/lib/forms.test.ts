import {
  AssetType,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  dealRequestCreateSchema,
} from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  bandLabelFor,
  bandsRange,
  budgetFieldsFor,
  FIND_DEFAULTS,
  FIND_STEP_FIELDS,
  findProgress,
  toFindPayload,
  validateFind,
  type FindFormValues,
} from './find-form';
import { formatMoneyInput, parseAreaToSqm, parseMoney, type FieldIssue } from './form-common';
import { dealTypesFor } from './labels';
import {
  composeDescription,
  priceFieldsFor,
  SELL_DEFAULTS,
  SELL_STEP_FIELDS,
  sellAddressDetail,
  sellExclusiveSqm,
  sellFloor,
  sellFormSchema,
  sellPriceLabel,
  sellFloorClassText,
  sellProgress,
  toSellPayload,
  validateSell,
  type SellFormValues,
} from './sell-form';

const TODAY = '2026-11-23';
const AGENCY = '0b6f2c1e-0000-4000-8000-0000000000b1';
const paths = (issues: FieldIssue[]) => issues.map((i) => i.path);

const sell = (over: Partial<SellFormValues> = {}): SellFormValues => ({
  ...SELL_DEFAULTS,
  assetType: AssetType.APT,
  roadAddress: '전남 순천시 해룡면 신대2로 40',
  bcode: '1215033028',
  complexId: '0b6f2c1e-0000-4000-8000-0000000000c1',
  complexName: '신대 레이크파크 1단지',
  dong: '103',
  ho: '1502',
  dealType: DealType.SALE,
  salePrice: '44,500',
  priceNegotiable: true,
  areaTypeId: '0b6f2c1e-0000-4000-8000-0000000000a1',
  areaTypeSqm: '84.98',
  areaTypeLabel: '34평',
  moveInDate: '2027-02-15',
  moveInNegotiable: true,
  description: '남향 고층입니다.',
  photos: [{ id: '0b6f2c1e-0000-4000-8000-0000000000f1', url: '/m/1', name: 'a.jpg' }],
  contactName: ' 김하늘 ',
  contactPhone: '010-0000-1234',
  agreePrivacy: true,
  agreeProvide: true,
  ...over,
});

const find = (over: Partial<FindFormValues> = {}): FindFormValues => ({
  ...FIND_DEFAULTS,
  assetType: AssetType.APT,
  dealTypes: [DealType.SALE],
  regionCodes: ['1215033028'],
  priceMax: '4억 5,000',
  areaBands: ['20', '30'],
  roomsMin: '3',
  contactName: '김하늘',
  contactPhone: '01000001234',
  agreePrivacy: true,
  agreeProvide: true,
  ...over,
});

describe('money and area inputs', () => {
  it('parses 만원 amounts typed in several ways', () => {
    expect(parseMoney('')).toBeUndefined();
    expect(parseMoney('44,500')).toBe(44500);
    expect(parseMoney('4억 5,000')).toBe(45000);
    expect(parseMoney('abc')).toBeNull();
  });
  it('adds thousands separators only to plain digits', () => {
    expect(formatMoneyInput('44500')).toBe('44,500');
    expect(formatMoneyInput('44,5000')).toBe('445,000');
    expect(formatMoneyInput('4억')).toBe('4억');
    expect(formatMoneyInput('')).toBe('');
  });
  it('converts areas to ㎡ in the chosen unit', () => {
    expect(parseAreaToSqm('', 'pyeong')).toBeUndefined();
    expect(parseAreaToSqm('84.98', 'sqm')).toBe(84.98);
    expect(parseAreaToSqm('10', 'pyeong')).toBe(33.06);
    expect(parseAreaToSqm('-3', 'sqm')).toBeNull();
    expect(parseAreaToSqm('넓음', 'pyeong')).toBeNull();
  });
});

describe('내놓기 form', () => {
  it('accepts a complete form and maps it to the shared create schema', () => {
    const values = sell();
    expect(validateSell(values, TODAY)).toEqual([]);
    const payload = toSellPayload(values);
    const parsed = dealRequestCreateSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(payload).toMatchObject({
      type: DealRequestType.SELL_OR_LEASE,
      assetType: AssetType.APT,
      dealTypes: [DealType.SALE],
      contactName: '김하늘',
      contactPhone: '01000001234',
      addressDetail: '103동 1502호',
      exclusiveArea: 84.98,
      desiredSalePrice: 44500,
      moveInDate: '2027-02-15',
      targetAgencyIds: [],
      photoMediaIds: ['0b6f2c1e-0000-4000-8000-0000000000f1'],
    });
    expect(payload.description).toBe('· 가격 협의 가능\n· 입주일 협의 가능\n\n남향 고층입니다.');
    expect('desiredDeposit' in payload && payload.desiredDeposit).toBeFalsy();
  });

  it('never sends the 호-derived floor of a complex unit — only its 저/중/고 class', () => {
    const payload = toSellPayload(sell(), { floorsMax: 25 });
    expect(payload).not.toHaveProperty('floor', 15);
    expect('floor' in payload && payload.floor).toBeFalsy();
    expect(payload.description?.startsWith('· 중층 (총 25층)\n· 가격 협의 가능')).toBe(true);
    expect(sellFloorClassText(sell({ ho: '2201' }), 25)).toBe('고층 (총 25층)');
    expect(sellFloorClassText(sell(), null)).toBeNull();
    // Other assets keep the floor the owner typed.
    const house = sell({ assetType: AssetType.HOUSE, floor: '2', dong: '', ho: '' });
    expect(toSellPayload(house, { floorsMax: 25 })).toMatchObject({ floor: 2 });
  });

  it('preselects 매매 so the deal type is never silently empty', () => {
    expect(SELL_DEFAULTS.dealType).toBe(DealType.SALE);
    expect(paths(validateSell(sell({ dealType: SELL_DEFAULTS.dealType }), TODAY))).toEqual([]);
  });

  it('reports the required fields of an empty form', () => {
    const issues = paths(validateSell(SELL_DEFAULTS, TODAY));
    expect(issues).toEqual(
      expect.arrayContaining([
        'assetType',
        'roadAddress',
        'salePrice',
        'area',
        'moveInDate',
        'contactName',
        'contactPhone',
        'agreePrivacy',
        'agreeProvide',
      ]),
    );
    expect(issues).not.toContain('dong'); // only complex assets need 동/호
  });

  it('requires 동/호 for complex assets and prices per deal type', () => {
    expect(paths(validateSell(sell({ dong: '', ho: '' }), TODAY))).toEqual(['dong', 'ho']);
    expect(paths(validateSell(sell({ salePrice: '' }), TODAY))).toEqual(['salePrice']);
    const monthly = sell({ dealType: DealType.MONTHLY, salePrice: '', deposit: '3,000' });
    expect(paths(validateSell(monthly, TODAY))).toEqual(['monthlyRent']);
    expect(validateSell({ ...monthly, monthlyRent: '90' }, TODAY)).toEqual([]);
    expect(toSellPayload({ ...monthly, monthlyRent: '90' })).toMatchObject({
      desiredDeposit: 3000,
      desiredMonthlyRent: 90,
      desiredSalePrice: undefined,
    });
  });

  it('validates phone, past dates, deal types of the asset and selected agencies', () => {
    expect(paths(validateSell(sell({ contactPhone: '02-123-4567' }), TODAY))).toEqual([
      'contactPhone',
    ]);
    expect(paths(validateSell(sell({ moveInDate: '2026-11-01' }), TODAY))).toEqual(['moveInDate']);
    expect(validateSell(sell({ moveInDate: '', moveInNow: true }), TODAY)).toEqual([]);
    expect(
      paths(validateSell(sell({ assetType: AssetType.LAND, dealType: DealType.JEONSE }), TODAY)),
    ).toContain('dealType');
    const selected = sell({ visibility: DealRequestVisibility.SELECTED_AGENCIES });
    expect(paths(validateSell(selected, TODAY))).toEqual(['targetAgencies']);
    const picked = { ...selected, targetAgencies: [{ id: AGENCY, name: '신대중앙' }] };
    expect(validateSell(picked, TODAY)).toEqual([]);
    expect(toSellPayload(picked).targetAgencyIds).toEqual([AGENCY]);
    expect(dealRequestCreateSchema.safeParse(toSellPayload(picked)).success).toBe(true);
  });

  it('runs through the zod wrapper used by react-hook-form', () => {
    expect(sellFormSchema.safeParse(sell()).success).toBe(true);
    const bad = sellFormSchema.safeParse(sell({ contactPhone: '' }));
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(['contactPhone']);
  });

  it('derives private address, floor, area and flags', () => {
    expect(sellAddressDetail(sell({ dong: '103동', ho: '1502호' }))).toBe('103동 1502호');
    const house = sell({ assetType: AssetType.HOUSE, addressDetail: ' 2층 ', floor: '2' });
    expect(sellAddressDetail(house)).toBe('2층');
    expect(sellFloor(house)).toBe(2);
    expect(sellFloor(sell({ ho: '302' }))).toBe(3);
    expect(sellFloor(sell({ ho: 'B01' }))).toBeUndefined();
    expect(sellExclusiveSqm(sell({ areaTypeId: '', area: '25.7', areaUnit: 'pyeong' }))).toBe(
      84.96,
    );
    expect(sellExclusiveSqm(sell({ areaTypeId: '', area: '' }))).toBeUndefined();
    expect(composeDescription('', {})).toBeUndefined();
    expect(composeDescription(' 메모 ', { moveInNow: true, moveInNegotiable: true })).toBe(
      '· 즉시 입주 가능\n\n메모',
    );
    expect(sellPriceLabel(DealType.MONTHLY)).toBe('희망 보증금 / 월세');
    expect(priceFieldsFor(DealType.PRESALE)).toEqual({ sale: true, deposit: false, rent: false });
  });

  it('counts required-field progress and covers every validated field in a step', () => {
    expect(sellProgress(sell())).toEqual({ done: 9, total: 9 });
    expect(sellProgress(SELL_DEFAULTS).done).toBeLessThan(3);
    const stepFields = new Set(SELL_STEP_FIELDS.flat());
    for (const path of paths(validateSell(SELL_DEFAULTS, TODAY))) {
      expect(stepFields.has(path as keyof SellFormValues)).toBe(true);
    }
  });
});

describe('구하기 form', () => {
  it('accepts a complete form and maps it to the shared create schema', () => {
    const values = find();
    expect(validateFind(values, TODAY)).toEqual([]);
    const payload = toFindPayload(values);
    expect(dealRequestCreateSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      type: DealRequestType.WANTED,
      regionCodes: ['1215033028'],
      priceMax: 45000,
      // 20평대 + 30평대 (공급 평형) → 전용 40–95㎡, the exact bands travel in the description.
      areaMin: 40,
      areaMax: 95,
      roomsMin: 3,
      description: '· 희망 평형: 20평대, 30평대',
    });
    expect('depositMax' in payload && payload.depositMax).toBeFalsy();
  });

  it('maps 평형 bands to 전용 ranges, or takes a typed 전용 ㎡ / 실면적 range', () => {
    expect(bandsRange([])).toBeNull();
    expect(bandsRange(['30'])).toEqual({ min: 62, max: 95 });
    expect(bandsRange(['50', '10'])).toEqual({ min: undefined, max: undefined });
    expect(bandLabelFor(40, 95)).toBe('20~30평대');
    expect(bandLabelFor(125, null)).toBe('50평 이상');
    expect(bandLabelFor(59.5, null)).toBeNull();
    const custom = find({ areaCustom: true, areaMin: '59', areaMax: '85' });
    expect(toFindPayload(custom)).toMatchObject({ areaMin: 59, areaMax: 85 });
    expect(toFindPayload(custom).description).toBeUndefined();
    const room = find({
      assetType: AssetType.ONEROOM,
      dealTypes: [DealType.MONTHLY],
      priceMax: '',
      depositMax: '1,000',
      rentMax: '50',
      areaMin: '8',
      areaUnit: 'pyeong',
    });
    expect(validateFind(room, TODAY)).toEqual([]);
    expect(toFindPayload(room)).toMatchObject({ areaMin: 26.45, areaMax: undefined });
  });

  it('needs asset type, deal types, regions and a maximum budget per deal type', () => {
    expect(paths(validateFind(FIND_DEFAULTS, TODAY))).toEqual(
      expect.arrayContaining(['assetType', 'dealTypes', 'regionCodes', 'contactPhone']),
    );
    const rent = find({ dealTypes: [DealType.JEONSE, DealType.MONTHLY], priceMax: '' });
    expect(paths(validateFind(rent, TODAY))).toEqual([
      'depositMax',
      'monthlyDepositMax',
      'rentMax',
    ]);
    expect(budgetFieldsFor(rent.dealTypes)).toEqual({
      price: false,
      deposit: true,
      depositLabel: '전세 보증금',
      monthlyDeposit: true,
      rent: true,
    });
    const ok = { ...rent, depositMax: '20,000', monthlyDepositMax: '3,000', rentMax: '60' };
    expect(validateFind(ok, TODAY)).toEqual([]);
    const payload = toFindPayload(ok);
    // One deposit column: the union, with the per-type ranges spelled out for the agencies.
    expect(payload).toMatchObject({
      depositMin: undefined,
      depositMax: 20000,
      rentMax: 60,
      priceMax: undefined,
    });
    expect(payload.description).toContain('· 전세 보증금 2억 이하\n· 월세 보증금 3,000 이하');
    expect(budgetFieldsFor([DealType.MONTHLY])).toMatchObject({
      depositLabel: '보증금',
      monthlyDeposit: false,
    });
  });

  it('rejects inverted ranges', () => {
    expect(paths(validateFind(find({ priceMin: '5억' }), TODAY))).toEqual(['priceMax']);
    const area = find({ areaCustom: true, areaMin: '90', areaMax: '60' });
    expect(paths(validateFind(area, TODAY))).toEqual(['areaMax']);
    // Bands mode ignores stale typed values.
    expect(validateFind(find({ areaMin: '90', areaMax: '60' }), TODAY)).toEqual([]);
  });

  it('tracks progress and keeps validated fields inside the steps', () => {
    expect(findProgress(find())).toEqual({ done: 6, total: 6 });
    const stepFields = new Set(FIND_STEP_FIELDS.flat());
    for (const path of paths(validateFind(FIND_DEFAULTS, TODAY))) {
      expect(stepFields.has(path as keyof FindFormValues)).toBe(true);
    }
  });
});

describe('deal types per asset type', () => {
  it('offers 분양권 only for 아파트·오피스텔 and no 전세 for 토지', () => {
    expect(dealTypesFor(AssetType.APT)).toContain(DealType.PRESALE);
    expect(dealTypesFor(AssetType.ONEROOM)).not.toContain(DealType.PRESALE);
    expect(dealTypesFor(AssetType.LAND)).toEqual([DealType.SALE, DealType.MONTHLY]);
  });
});
