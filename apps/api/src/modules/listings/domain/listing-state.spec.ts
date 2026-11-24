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
    roadAddress: '전남광주통합특별시 순천시 연향로 1',
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
    const p = propertyStateFromInput(draft.property, '12150');
    const l = listingStateFromInput(draft);
    const cols = listingWriteColumns(l, p, 2010);
    expect(cols).toMatchObject({
      priceSort: 31_500,
      floorClass: 'HIGH',
      builtYear: 2012,
      exclusiveArea: 59.9,
      sggCode: '12150',
      lat: 34.95,
    });
    expect(cols.moveInDate?.toISOString()).toBe('2027-03-01T00:00:00.000Z');
    expect(cols).not.toHaveProperty('ho');
  });

  it('falls back to the complex 준공년도 when the property has no 사용승인일', () => {
    const p = { ...propertyStateFromInput(draft.property, '12150'), approvalDate: null };
    expect(listingWriteColumns(listingStateFromInput(draft), p, 2010).builtYear).toBe(2010);
  });

  it('patches: undefined keeps, null clears', () => {
    const p = applyPropertyPatch(propertyStateFromInput(draft.property, '12150'), {
      ho: null,
      floor: 2,
      approvalDate: '2020-01-02',
      dong: undefined,
    });
    expect(p).toMatchObject({
      ho: null,
      floor: 2,
      roadAddress: '전남광주통합특별시 순천시 연향로 1',
    });
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

  it('nulls price fields that do not apply to the deal type (incl. after a deal-type patch)', () => {
    const p = propertyStateFromInput(draft.property, '12150');
    const monthly = listingStateFromInput(
      listingDraftSchema.parse({
        dealType: 'MONTHLY',
        deposit: 1000,
        monthlyRent: 50,
        salePrice: 30_000,
        property: draft.property,
      }),
    );
    expect(listingWriteColumns(monthly, p, null)).toMatchObject({
      salePrice: null,
      deposit: 1000,
      monthlyRent: 50,
      priceSort: 1000,
    });
    const sale = applyListingPatch(monthly, { dealType: 'SALE', salePrice: 30_000 });
    expect(listingWriteColumns(sale, p, null)).toMatchObject({
      salePrice: 30_000,
      deposit: null,
      monthlyRent: null,
      presalePrice: null,
      premium: null,
      priceSort: 30_000,
    });
  });
});
