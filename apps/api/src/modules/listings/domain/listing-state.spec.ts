import { listingDraftSchema } from '@house/shared';
import {
  applyListingPatch,
  applyPropertyPatch,
  listingStateFromInput,
  listingWriteColumns,
  propertyStateFromInput,
} from './listing-state';

const draft = listingDraftSchema.parse({
  dealType: 'PRESALE',
  presalePrice: 30_000,
  premium: 1_500,
  moveInType: 'DATE',
  moveInDate: '2027-03-01',
  property: {
    assetType: 'APT',
    roadAddress: '전라남도 순천시 연향로 1',
    lat: 34.95,
    lng: 127.49,
    floor: 14,
    totalFloors: 15,
    exclusiveArea: 59.9,
    approvalDate: '2012-05-01',
    ho: '1401',
  },
});

describe('listing state', () => {
  it('derives search columns and the price sort key', () => {
    const p = propertyStateFromInput(draft.property, '46150');
    const l = listingStateFromInput(draft);
    const cols = listingWriteColumns(l, p, 2010);
    expect(cols).toMatchObject({
      priceSort: 31_500,
      floorClass: 'HIGH',
      builtYear: 2012,
      exclusiveArea: 59.9,
      sggCode: '46150',
      lat: 34.95,
    });
    expect(cols.moveInDate?.toISOString()).toBe('2027-03-01T00:00:00.000Z');
    expect(cols).not.toHaveProperty('ho');
  });

  it('falls back to the complex 준공년도 when the property has no 사용승인일', () => {
    const p = { ...propertyStateFromInput(draft.property, '46150'), approvalDate: null };
    expect(listingWriteColumns(listingStateFromInput(draft), p, 2010).builtYear).toBe(2010);
  });

  it('patches: undefined keeps, null clears', () => {
    const p = applyPropertyPatch(propertyStateFromInput(draft.property, '46150'), {
      ho: null,
      floor: 2,
      approvalDate: '2020-01-02',
      dong: undefined,
    });
    expect(p).toMatchObject({ ho: null, floor: 2, roadAddress: '전라남도 순천시 연향로 1' });
    expect(p.approvalDate?.toISOString()).toBe('2020-01-02T00:00:00.000Z');

    const l = applyListingPatch(listingStateFromInput(draft), {
      premium: null,
      moveInDate: null,
      options: ['ELEVATOR'],
    });
    expect(l).toMatchObject({
      premium: null,
      moveInDate: null,
      options: ['ELEVATOR'],
      presalePrice: 30_000,
    });
  });
});
