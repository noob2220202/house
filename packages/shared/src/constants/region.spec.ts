import { agencySearchQuerySchema } from '../agencies/schemas';
import { regionCodeSchema } from '../schemas/common';
import { complexSearchQuerySchema, regionCodeParamSchema } from '../schemas/complexes';
import { listingListQuerySchema } from '../schemas/listings';
import {
  canonicalRegionCode,
  DEFAULT_REGION_NAME,
  DEFAULT_SGG_CODE,
  DEFAULT_SIDO_CODE,
  legacyRegionCode,
  sggCodeOf,
} from './region';

describe('region constants', () => {
  it('serve 전남광주통합특별시 순천시 (12150) since 2026-07-01', () => {
    expect(DEFAULT_SGG_CODE).toBe('12150');
    expect(DEFAULT_SIDO_CODE).toBe('12');
    expect(DEFAULT_REGION_NAME).toBe('전남광주통합특별시 순천시');
    expect(DEFAULT_SGG_CODE.startsWith(DEFAULT_SIDO_CODE)).toBe(true);
  });
});

describe('canonicalRegionCode', () => {
  it.each([
    ['46', '12'],
    ['46150', '12150'],
    ['46150132', '12150132'],
    ['4615013200', '1215013200'],
    ['4615031022', '1215031022'],
  ])('maps legacy %s → %s', (legacy, current) => {
    expect(canonicalRegionCode(legacy)).toBe(current);
  });

  it('is idempotent and leaves current codes alone', () => {
    for (const code of ['12', '12150', '12150132', '1215031022']) {
      expect(canonicalRegionCode(code)).toBe(code);
      expect(canonicalRegionCode(canonicalRegionCode(code))).toBe(code);
    }
  });

  it('never guesses codes of other regions', () => {
    // 광양시 became 12190 (not a prefix swap) — only the 순천시 alias is known.
    for (const code of ['46230', '4623010100', '46130', '29110', '11', '1111010100', '4615']) {
      expect(canonicalRegionCode(code)).toBe(code);
    }
  });

  it('trims code-shaped input and returns other strings unchanged', () => {
    expect(canonicalRegionCode(' 46150 ')).toBe('12150');
    expect(canonicalRegionCode('46150-2020-00012')).toBe('46150-2020-00012');
    expect(canonicalRegionCode('')).toBe('');
    expect(canonicalRegionCode('abc')).toBe('abc');
  });

  it('keeps the 시군구 derivation consistent', () => {
    expect(sggCodeOf(canonicalRegionCode('4615031022'))).toBe(DEFAULT_SGG_CODE);
  });
});

describe('legacyRegionCode', () => {
  it('inverts the alias for every code form', () => {
    expect(legacyRegionCode('12')).toBe('46');
    expect(legacyRegionCode('12150')).toBe('46150');
    expect(legacyRegionCode('12150132')).toBe('46150132');
    expect(legacyRegionCode('1215031022')).toBe('4615031022');
  });

  it('is null without an alias', () => {
    expect(legacyRegionCode('12190')).toBeNull();
    expect(legacyRegionCode('46150')).toBeNull();
    expect(legacyRegionCode('11')).toBeNull();
    expect(legacyRegionCode('x')).toBeNull();
  });

  it('round-trips through canonicalRegionCode', () => {
    for (const code of ['12', '12150', '12150132', '1215031022']) {
      const legacy = legacyRegionCode(code);
      expect(legacy).not.toBeNull();
      expect(canonicalRegionCode(legacy as string)).toBe(code);
    }
  });
});

describe('input schemas canonicalize legacy region codes', () => {
  it('regionCodeSchema', () => {
    expect(regionCodeSchema.parse('4615031022')).toBe('1215031022');
    expect(regionCodeSchema.parse('12150')).toBe('12150');
    expect(regionCodeSchema.safeParse('4615-0').success).toBe(false);
  });

  it('regions / 단지 / 매물 search queries', () => {
    expect(regionCodeParamSchema.parse({ code: '46150132' }).code).toBe('12150132');
    expect(complexSearchQuerySchema.parse({ emdCode: '46150132' }).emdCode).toBe('12150132');
    expect(listingListQuerySchema.parse({ emdCode: '4615013200' }).emdCode).toBe('1215013200');
  });

  it('agency search filter', () => {
    expect(agencySearchQuerySchema.parse({ emdCode: '46150132' }).emdCode).toBe('12150132');
  });
});
