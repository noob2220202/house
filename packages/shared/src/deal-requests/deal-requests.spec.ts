import { DealRequestType, DealRequestVisibility } from '../enums/deal-request';
import { AssetType, DealType } from '../enums/listing';
import { dealRequestExpiry, proposalTermsIssues, regionCodesWithinSgg } from './rules';
import {
  dealRequestCreateSchema,
  notificationReadSchema,
  proposalAcceptSchema,
  proposalCreateSchema,
} from './schemas';

const AGENCY = '0190a0b0-0000-7000-8000-000000000001';

const sell = {
  type: DealRequestType.SELL_OR_LEASE,
  assetType: AssetType.APT,
  dealTypes: [DealType.SALE],
  visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
  contactName: ' 홍길동 ',
  contactPhone: '010-1234-5678',
  roadAddress: '전라남도 순천시 중앙로 1',
  desiredSalePrice: 30000,
};

const wanted = {
  type: DealRequestType.WANTED,
  assetType: AssetType.ONEROOM,
  dealTypes: [DealType.MONTHLY],
  visibility: DealRequestVisibility.SELECTED_AGENCIES,
  targetAgencyIds: [AGENCY],
  contactName: '김철수',
  contactPhone: '+82 10 9876 5432',
  regionCodes: ['4615010100'],
  depositMin: 300,
  depositMax: 1000,
  rentMax: 50,
};

function issuePaths(input: unknown): string[] {
  const r = dealRequestCreateSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
}

describe('dealRequestCreateSchema', () => {
  it('parses a 내놓기 request and normalizes the phone (never verified)', () => {
    const v = dealRequestCreateSchema.parse(sell);
    expect(v.contactPhone).toBe('01012345678');
    expect(v.contactName).toBe('홍길동');
    expect(v.targetAgencyIds).toEqual([]);
    expect(v.type === DealRequestType.SELL_OR_LEASE && v.photoMediaIds).toEqual([]);
  });

  it('parses a 구하기 request with +82 phone', () => {
    const v = dealRequestCreateSchema.parse(wanted);
    expect(v.contactPhone).toBe('01098765432');
  });

  it('rejects landlines for the requester phone', () => {
    expect(issuePaths({ ...sell, contactPhone: '061-749-1234' })).toEqual(['contactPhone']);
  });

  it('rejects deal types the asset type does not allow', () => {
    expect(
      issuePaths({ ...sell, assetType: AssetType.LAND, dealTypes: [DealType.PRESALE] }),
    ).toEqual(['dealTypes.0']);
  });

  it('rejects price fields that do not match the deal types', () => {
    expect(issuePaths({ ...sell, desiredMonthlyRent: 50 })).toEqual(['desiredMonthlyRent']);
    expect(issuePaths({ ...wanted, priceMax: 1000 })).toEqual(['priceMin']);
  });

  it('rejects inverted ranges', () => {
    expect(issuePaths({ ...wanted, depositMin: 2000 })).toEqual(['depositMin']);
  });

  it('requires targets for SELECTED_AGENCIES and forbids them otherwise', () => {
    expect(issuePaths({ ...wanted, targetAgencyIds: [] })).toEqual(['targetAgencyIds']);
    expect(issuePaths({ ...sell, targetAgencyIds: [AGENCY] })).toEqual(['targetAgencyIds']);
    expect(issuePaths({ ...wanted, targetAgencyIds: [AGENCY, AGENCY] })).toEqual([
      'targetAgencyIds',
    ]);
  });

  it('applies asset-specific fields', () => {
    expect(
      issuePaths({ ...sell, assetType: AssetType.LAND, floor: 3, desiredSalePrice: undefined }),
    ).toEqual(['floor']);
    expect(
      issuePaths({
        ...wanted,
        assetType: AssetType.LAND,
        roomsMin: 2,
        dealTypes: [DealType.MONTHLY],
      }),
    ).toEqual(['roomsMin']);
    expect(issuePaths({ ...wanted, complexIds: [AGENCY] })).toEqual(['complexIds']);
    expect(issuePaths({ ...sell, assetType: AssetType.HOUSE, complexId: AGENCY })).toEqual([
      'complexId',
    ]);
  });

  it('requires lat and lng together', () => {
    expect(issuePaths({ ...sell, lat: 34.95 })).toEqual(['lat']);
  });

  it('rejects an unknown type', () => {
    expect(issuePaths({ ...sell, type: 'OTHER' })).toEqual(['type']);
  });
});

describe('proposal schemas', () => {
  it('defaults listingIds and rejects duplicates', () => {
    expect(proposalCreateSchema.parse({ message: '안녕하세요' }).listingIds).toEqual([]);
    expect(
      proposalCreateSchema.safeParse({ message: 'x', listingIds: [AGENCY, AGENCY] }).success,
    ).toBe(false);
  });

  it('accept defaults to sharing contact (explicit consent in the UI)', () => {
    expect(proposalAcceptSchema.parse(undefined)).toEqual({ shareContact: true });
    expect(proposalAcceptSchema.parse({ shareContact: false })).toEqual({ shareContact: false });
  });

  it('terms must match the request deal types', () => {
    expect(proposalTermsIssues([DealType.JEONSE], { suggestedDeposit: 10000 })).toEqual([]);
    expect(
      proposalTermsIssues([DealType.JEONSE], { suggestedMonthlyRent: 50 }).map((i) => i.path[0]),
    ).toEqual(['suggestedMonthlyRent']);
    expect(
      proposalTermsIssues([DealType.MONTHLY], { suggestedPrice: 1 }).map((i) => i.path[0]),
    ).toEqual(['suggestedPrice']);
  });
});

describe('helpers', () => {
  it('notificationReadSchema needs exactly one of ids / all', () => {
    expect(notificationReadSchema.safeParse({ all: true }).success).toBe(true);
    expect(notificationReadSchema.safeParse({ ids: [AGENCY] }).success).toBe(true);
    expect(notificationReadSchema.safeParse({}).success).toBe(false);
    expect(notificationReadSchema.safeParse({ all: true, ids: [AGENCY] }).success).toBe(false);
  });

  it('regionCodesWithinSgg', () => {
    expect(regionCodesWithinSgg(['46150', '4615010100'], '46150')).toBe(true);
    expect(regionCodesWithinSgg(['4613010100'], '46150')).toBe(false);
    expect(regionCodesWithinSgg(['46'], '46150')).toBe(false);
  });

  it('dealRequestExpiry adds whole days', () => {
    expect(dealRequestExpiry(new Date('2026-01-01T00:00:00Z'), 30).toISOString()).toBe(
      '2026-01-31T00:00:00.000Z',
    );
  });
});
