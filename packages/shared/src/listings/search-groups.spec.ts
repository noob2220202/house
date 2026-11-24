import {
  agencyListingListQuerySchema,
  listingFilterSchema,
  listingListQuerySchema,
  propertyInputSchema,
} from '../schemas/listings';
import {
  effectiveRoomType,
  formatListingNo,
  landCategoryOf,
  landZoneOf,
  parseListingNo,
} from './rules';

describe('방 구성 (effectiveRoomType)', () => {
  it('derives 원룸·투룸·쓰리룸+ from the room count for 원룸·투룸 listings only', () => {
    expect(effectiveRoomType('ONEROOM', null, 1)).toBe('ONE_ROOM');
    expect(effectiveRoomType('ONEROOM', null, 2)).toBe('TWO_ROOM');
    expect(effectiveRoomType('ONEROOM', null, 4)).toBe('THREE_ROOM_PLUS');
    expect(effectiveRoomType('ONEROOM', null, 0)).toBeNull();
    expect(effectiveRoomType('ONEROOM', null, null)).toBeNull();
    expect(effectiveRoomType('APT', null, 3)).toBeNull();
  });

  it('prefers the stated type (1.5룸) on buildings and never applies to land', () => {
    expect(effectiveRoomType('ONEROOM', 'ONE_HALF_ROOM', 1)).toBe('ONE_HALF_ROOM');
    expect(effectiveRoomType('OFFICETEL', 'TWO_ROOM', null)).toBe('TWO_ROOM');
    expect(effectiveRoomType('LAND', 'ONE_ROOM', 1)).toBeNull();
    expect(effectiveRoomType(null, 'ONE_ROOM', 1)).toBeNull();
  });
});

describe('용도지역 / 지목 groups', () => {
  it.each([
    ['제2종일반주거지역', 'RESIDENTIAL'],
    ['준주거지역', 'RESIDENTIAL'],
    ['일반상업지역', 'COMMERCIAL'],
    ['준공업지역', 'INDUSTRIAL'],
    ['자연녹지지역', 'GREEN'],
    ['계획관리지역', 'MANAGEMENT'],
    ['보전관리지역', 'MANAGEMENT'],
    ['농림지역', 'AGRICULTURAL'],
    ['자연환경보전지역', 'CONSERVATION'],
    [' 생산 관리 지역 ', 'MANAGEMENT'],
    ['RESIDENTIAL', 'RESIDENTIAL'],
  ])('%s → %s', (zoning, zone) => {
    expect(landZoneOf(zoning)).toBe(zone);
  });

  it('unknown or empty 용도지역 has no group', () => {
    expect(landZoneOf('미지정')).toBeNull();
    expect(landZoneOf('')).toBeNull();
    expect(landZoneOf(null)).toBeNull();
    expect(landZoneOf('toString')).toBeNull();
  });

  it('maps the common 지목 and puts every other 지목 under ETC', () => {
    expect(landCategoryOf('대')).toBe('DAE');
    expect(landCategoryOf('대지')).toBe('DAE');
    expect(landCategoryOf('전')).toBe('JEON');
    expect(landCategoryOf('답')).toBe('DAP');
    expect(landCategoryOf('과수원')).toBe('GWASUWON');
    expect(landCategoryOf(' 임야 ')).toBe('IMYA');
    expect(landCategoryOf('잡종지')).toBe('JAPJONGJI');
    expect(landCategoryOf('공장용지')).toBe('ETC');
    expect(landCategoryOf('constructor')).toBe('ETC');
    expect(landCategoryOf('JEON')).toBe('JEON');
    expect(landCategoryOf('  ')).toBeNull();
    expect(landCategoryOf(null)).toBeNull();
  });
});

describe('매물번호', () => {
  it('formats the sequential number', () => {
    expect(formatListingNo(100412)).toBe('100412');
    expect(formatListingNo(null)).toBeNull();
    expect(formatListingNo(0)).toBeNull();
  });

  it('reads a number out of a search text', () => {
    expect(parseListingNo('100412')).toBe(100412);
    expect(parseListingNo(' 매물번호 100412 ')).toBe(100412);
    expect(parseListingNo('#100412')).toBe(100412);
    expect(parseListingNo('레이크파크 101')).toBeNull();
    expect(parseListingNo('99999999999')).toBeNull();
    expect(parseListingNo('0')).toBeNull();
    expect(parseListingNo(undefined)).toBeNull();
  });
});

describe('search filter schemas', () => {
  it('accepts the 방 구성 / 용도지역 / 지목 filters as csv', () => {
    const f = listingFilterSchema.parse({
      roomTypes: 'ONE_ROOM,ONE_HALF_ROOM',
      landZones: 'GREEN',
      landCategories: ['DAE', 'IMYA'],
    });
    expect(f).toMatchObject({
      roomTypes: ['ONE_ROOM', 'ONE_HALF_ROOM'],
      landZones: ['GREEN'],
      landCategories: ['DAE', 'IMYA'],
    });
    expect(listingListQuerySchema.safeParse({ roomTypes: 'TWOROOM' }).success).toBe(false);
  });

  it('property input takes an optional stated 방 구성', () => {
    const base = { assetType: 'ONEROOM', roadAddress: '순천시 1', lat: 34.9, lng: 127.5 };
    expect(propertyInputSchema.parse({ ...base, roomType: 'ONE_HALF_ROOM' }).roomType).toBe(
      'ONE_HALF_ROOM',
    );
    expect(propertyInputSchema.safeParse({ ...base, roomType: '1.5룸' }).success).toBe(false);
  });

  it('console list query: text, asset types, reminders and the console sorts', () => {
    const q = agencyListingListQuerySchema.parse({
      statuses: 'ACTIVE,RESERVED',
      q: '  레이크파크 ',
      assetTypes: 'APT',
      verificationDue: 'true',
      coBrokered: '1',
      sort: 'VERIFY_DUE',
    });
    expect(q).toMatchObject({
      statuses: ['ACTIVE', 'RESERVED'],
      q: '레이크파크',
      assetTypes: ['APT'],
      verificationDue: true,
      coBrokered: true,
      sort: 'VERIFY_DUE',
    });
    const empty = agencyListingListQuerySchema.parse({ q: '   ' });
    expect(empty.q).toBeUndefined();
    expect(empty.sort).toBe('UPDATED');
    expect(agencyListingListQuerySchema.safeParse({ sort: 'LISTINGS' }).success).toBe(false);
    expect(agencyListingListQuerySchema.safeParse({ q: 'x'.repeat(61) }).success).toBe(false);
  });
});
