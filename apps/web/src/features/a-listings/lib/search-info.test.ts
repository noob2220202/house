import { describe, expect, it } from 'vitest';
import { FORM_DEFAULTS, toDraftPayload, toUpdatePayload, type ListingFormValues } from './form';
import { searchInfoItems } from './search-info';

const form = (patch: Partial<ListingFormValues>): ListingFormValues => ({
  ...FORM_DEFAULTS,
  roadAddress: '전남광주통합특별시 순천시 해룡면 신대3길 9',
  lat: 34.93,
  lng: 127.55,
  ...patch,
});

describe('wizard 방 구성 / 지목 / 용도지역 (shared property schema)', () => {
  it('sends a stated 1.5룸 for 원룸·투룸 and derives the shown group from the room count', () => {
    const stated = toDraftPayload(
      form({ assetType: 'ONEROOM', rooms: '1', roomType: 'ONE_HALF_ROOM' }),
    );
    expect(stated.payload.property.roomType).toBe('ONE_HALF_ROOM');
    expect(searchInfoItems(stated.payload)).toEqual([
      expect.objectContaining({ field: 'roomType', done: true, group: '1.5룸', step: 2 }),
    ]);

    const derived = toDraftPayload(form({ assetType: 'ONEROOM', rooms: '2' }));
    expect(derived.payload.property.roomType).toBeUndefined();
    expect(searchInfoItems(derived.payload)[0]).toMatchObject({ done: true, group: '투룸' });
    expect(
      searchInfoItems(toDraftPayload(form({ assetType: 'ONEROOM' })).payload)[0],
    ).toMatchObject({ done: false, group: null });
    // A stated 방 구성 that no longer applies (type changed) is not sent — and cleared on PATCH.
    const apt = toDraftPayload(form({ assetType: 'APT', roomType: 'ONE_HALF_ROOM' })).payload;
    expect(apt.property.roomType).toBeUndefined();
    expect(toUpdatePayload(apt).property.roomType).toBeNull();
    expect(searchInfoItems(apt)).toEqual([]);
  });

  it('sends 지목 / 용도지역 as written for 토지 and maps them to the search groups', () => {
    const { payload, issues } = toDraftPayload(
      form({ assetType: 'LAND', landCategory: ' 임야 ', zoning: '계획관리지역', landArea: '512' }),
    );
    expect(issues).toEqual([]);
    expect(payload.property).toMatchObject({ landCategory: '임야', zoning: '계획관리지역' });
    expect(searchInfoItems(payload)).toEqual([
      expect.objectContaining({ field: 'landCategory', done: true, group: '임야' }),
      expect.objectContaining({ field: 'zoning', done: true, group: '관리지역' }),
    ]);
    const unknownZone = toDraftPayload(form({ assetType: 'LAND', zoning: '모름' })).payload;
    expect(searchInfoItems(unknownZone)[1]).toMatchObject({ done: false, group: null });
  });

  it('clears 지목 / 용도지역 of a land listing left empty, but never touches them for other types', () => {
    const land = toUpdatePayload(toDraftPayload(form({ assetType: 'LAND' })).payload);
    expect(land.property).toMatchObject({ zoning: null, landCategory: null });
    const house = toUpdatePayload(
      toDraftPayload(form({ assetType: 'HOUSE', zoning: '제1종일반주거지역' })).payload,
    );
    expect(house.property).not.toHaveProperty('zoning');
    expect(house.property).not.toHaveProperty('landCategory');
  });

  it('reports texts longer than the shared schema allows', () => {
    const { payload, issues } = toDraftPayload(
      form({ assetType: 'LAND', landCategory: '가'.repeat(21), zoning: '나'.repeat(51) }),
    );
    expect(issues.map((i) => i.field).sort()).toEqual(['landCategory', 'zoning']);
    expect(payload.property.landCategory).toBeUndefined();
    expect(payload.property.zoning).toBeUndefined();
  });
});
