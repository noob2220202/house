import { describe, expect, it } from 'vitest';
import { dealRequestDetailSchema, type DealRequestDetail } from '../api/schemas';
import { toPickedAddress } from './daum-postcode';
import { isProposalPending, isRequestActive } from './labels';
import {
  regionName,
  regionNamer,
  regionSummary,
  SUNCHEON_REGIONS,
  toRegionOptions,
} from './regions';
import { displayAddress, inServiceArea, serviceRegionCodesOf } from './service-area';
import {
  requestAreaText,
  requestPriceLines,
  requestSubtitle,
  requestTitle,
  splitDescription,
} from './summary';

const base = {
  id: 'r1',
  status: 'OPEN',
  assetType: 'APT',
  visibility: 'ALL_AGENCIES_IN_REGION',
  contactName: '김하늘',
  contactPhone: '01000001234',
  createdAt: '2026-11-19T06:42:00.000Z',
  updatedAt: '2026-11-19T06:42:00.000Z',
};
const parse = (raw: Record<string, unknown>): DealRequestDetail =>
  dealRequestDetailSchema.parse({ ...base, ...raw });

const sell = parse({
  type: 'SELL_OR_LEASE',
  dealTypes: ['SALE'],
  roadAddress: '전남 순천시 해룡면 신대2로 40',
  addressDetail: '103동 1502호',
  complexName: '신대 레이크파크 1단지',
  exclusiveArea: 84.98,
  desiredSalePrice: 44500,
});
const wanted = parse({
  type: 'WANTED',
  dealTypes: ['JEONSE', 'MONTHLY'],
  regionCodes: ['1215012000', '1215012100', '1215033028'],
  depositMax: 20000,
  rentMin: 40,
  rentMax: 60,
  areaMin: 59.5,
  roomsMin: 2,
});

describe('request display helpers', () => {
  it('fills schema defaults for optional collections and counters', () => {
    expect(sell.photos).toEqual([]);
    expect(sell.proposals).toEqual([]);
    expect(sell.proposalCount).toBe(0);
    expect(sell.regionCodes).toEqual([]);
  });

  it('titles 내놓기 by complex / address and 구하기 by regions', () => {
    expect(requestTitle(sell)).toBe('신대 레이크파크 1단지');
    expect(requestTitle(parse({ ...sell, complexName: null }))).toBe('순천시 해룡면 신대2로 40');
    expect(requestTitle(wanted)).toBe('조례동 · 연향동 외 1곳 아파트');
  });

  it('builds subtitles and area text (전용면적 is always labelled)', () => {
    expect(requestSubtitle(sell)).toBe(
      '순천시 해룡면 신대2로 40 · 103동 1502호 · 전용 84.98㎡ (25.7평)',
    );
    expect(requestAreaText(wanted)).toBe('전용 59.5㎡ 이상');
    expect(requestSubtitle(wanted)).toBe('전용 59.5㎡ 이상 · 방 2개 이상');
    expect(requestAreaText(parse({ ...wanted, areaMin: '40', areaMax: '95' }))).toBe(
      '20~30평대 (전용 40~95㎡)',
    );
  });

  it('lists the prices that were given', () => {
    expect(requestPriceLines(sell)).toEqual([{ label: '희망 매매가', value: '4억 4,500' }]);
    expect(
      requestPriceLines(
        parse({ ...sell, desiredSalePrice: null, desiredDeposit: 500, desiredMonthlyRent: 42 }),
      ),
    ).toEqual([{ label: '희망 보증금/월세', value: '500/42' }]);
    expect(requestPriceLines(wanted)).toEqual([
      { label: '보증금', value: '2억 이하' },
      { label: '월세', value: '40 ~ 60' },
    ]);
  });

  it('splits the flag lines the form prepends to the description', () => {
    expect(splitDescription('· 가격 협의 가능\n· 입주일 협의 가능\n\n남향 고층')).toEqual({
      flags: ['가격 협의 가능', '입주일 협의 가능'],
      text: '남향 고층',
    });
    expect(splitDescription('그냥 메모\n· 목록')).toEqual({ flags: [], text: '그냥 메모\n· 목록' });
    expect(splitDescription(null)).toEqual({ flags: [], text: '' });
  });
});

describe('regions', () => {
  it('has unique 10-digit codes inside 순천시 and resolves names', () => {
    const codes = SUNCHEON_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^12150\d{5}$/.test(c))).toBe(true);
    expect(regionName('1215012100')).toBe('연향동');
    expect(regionName('9999999999')).toBe('9999999999');
    expect(regionSummary([])).toBe('');
    expect(regionSummary(['1215033028', '1215033029'])).toBe('신대지구 · 선월지구');
  });

  it('builds picker options from the backend regions with the preset presentation', () => {
    expect(toRegionOptions(undefined)).toEqual(SUNCHEON_REGIONS);
    const options = toRegionOptions([
      { code: '1215099900', name: '새동네', parentName: '해룡면' },
      { code: '1215013200', name: '왕지동' },
      { code: '1215025033', name: '신대지구', parentName: '해룡면' },
    ]);
    expect(options.map((o) => [o.code, o.group])).toEqual([
      ['1215025033', 'popular'],
      ['1215013200', 'popular'],
      ['1215099900', 'more'],
    ]);
    expect(options[0]?.hint).toBe('해룡면 신대리');
    expect(options[2]?.hint).toBe('해룡면');
    const nameOf = regionNamer(options);
    expect(nameOf('1215013200')).toBe('왕지동');
    expect(nameOf('1215012100')).toBe('연향동');
    expect(regionSummary(['1215013200', '1215099900'], 2, nameOf)).toBe('왕지동 · 새동네');
  });
});

describe('status helpers', () => {
  it('knows which requests and proposals still need the user', () => {
    expect(isRequestActive('OPEN')).toBe(true);
    expect(isRequestActive('MATCHED')).toBe(true);
    expect(isRequestActive('EXPIRED')).toBe(false);
    expect(isProposalPending('SENT')).toBe(true);
    expect(isProposalPending('VIEWED')).toBe(true);
    expect(isProposalPending('ACCEPTED')).toBe(false);
  });
});

describe('postcode helpers', () => {
  it('maps the widget payload to the stored address', () => {
    expect(
      toPickedAddress({
        zonecode: '58023',
        roadAddress: '',
        autoRoadAddress: '전남 순천시 해룡면 신대2로 40',
        jibunAddress: '전남 순천시 해룡면 신대리 1970',
        bcode: '1215031028',
        buildingName: '레이크파크',
        apartment: 'Y',
        userSelectedType: 'J',
      }),
    ).toEqual({
      roadAddress: '전남 순천시 해룡면 신대2로 40',
      jibunAddress: '전남 순천시 해룡면 신대리 1970',
      zonecode: '58023',
      bcode: '1215031028',
      buildingName: '레이크파크',
    });
  });
  it('canonicalizes a legacy 46150 postcode result to the 12150 code space (D1)', () => {
    expect(
      toPickedAddress({
        zonecode: '58023',
        roadAddress: '전남 순천시 해룡면 신대2로 40',
        jibunAddress: '',
        bcode: '4615031028',
        sigunguCode: '46150',
        buildingName: '',
        apartment: 'N',
        userSelectedType: 'R',
      }),
    ).toMatchObject({ bcode: '1215031028', sigunguCode: '12150' });
    expect(inServiceArea({ bcode: '4615031028' })).toBe(true);
    expect(serviceRegionCodesOf('4615031028')).toEqual(['1215031028']);
    expect(serviceRegionCodesOf('4613010100')).toEqual([]);
  });
  it('accepts 순천 addresses with the 12150 시군구 code', () => {
    expect(inServiceArea({ bcode: '1215031028' })).toBe(true);
    // Kakao postcode since the 전남·광주 통합: sido "전남광주통합특별시", sigunguCode 12150.
    expect(inServiceArea({ bcode: '1215013200', sigungu: '순천시', sigunguCode: '12150' })).toBe(
      true,
    );
    expect(inServiceArea({ bcode: '1215013200' })).toBe(true);
    expect(inServiceArea({ bcode: '4613010100', sigungu: '여수시', sigunguCode: '46130' })).toBe(
      false,
    );
    expect(inServiceArea({ bcode: '', sigungu: '광양시', sigunguCode: '46230' })).toBe(false);
    expect(inServiceArea({ bcode: '' })).toBe(true); // typed by hand — validated by the backend
    expect(serviceRegionCodesOf('1215031022')).toEqual(['1215031022']);
    expect(serviceRegionCodesOf('4613010100')).toEqual([]);
  });
  it('drops the 시·도 from displayed addresses', () => {
    expect(displayAddress('전남광주통합특별시 순천시 왕지2길 9-3')).toBe('순천시 왕지2길 9-3');
    expect(displayAddress('전남 순천시 해룡면 신대2로 40')).toBe('순천시 해룡면 신대2로 40');
    expect(displayAddress('전라남도 순천시 연향3로 20')).toBe('순천시 연향3로 20');
    expect(displayAddress('순천시 연향3로 20')).toBe('순천시 연향3로 20');
    expect(displayAddress(null)).toBe('');
  });
});
