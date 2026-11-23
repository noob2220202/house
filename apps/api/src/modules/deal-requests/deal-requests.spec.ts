import {
  AgencyInboxScope,
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  ProposalStatus,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import { canSeeContact, DealRequestMapper, maskName } from './deal-request.mapper';
import type {
  DealRequestAdminRow,
  DealRequestAgencyRow,
  DealRequestBaseRow,
  DealRequestContactRow,
} from './deal-request.selects';
import { parseCursor } from './notifications/notifications.service';
import type { DealRequestMediaPort } from './ports/media.port';
import { agencyInboxWhere, agencyVisibleWhere } from './services/deal-request-access';

const media: DealRequestMediaPort = {
  assertPhotosUsable: () => Promise.resolve(),
  publicUrl: (m, variant = 'medium') => `/media/${variant}/${m.storageKey}`,
  discardPhotos: () => Promise.resolve(0),
};
const mapper = new DealRequestMapper(media);
const AGENCY = '0190a0b0-0000-7000-8000-0000000000a1';
const NOW = new Date('2026-11-23T00:00:00.000Z');

function baseRow(over: Partial<DealRequestBaseRow> = {}): DealRequestBaseRow {
  return {
    id: '0190a0b0-0000-7000-8000-000000000001',
    type: DealRequestType.SELL_OR_LEASE,
    status: DealRequestStatus.OPEN,
    assetType: AssetType.APT,
    dealTypes: [DealType.SALE],
    visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
    sggCode: '46150',
    emdCode: '4615010100',
    roadAddress: '전라남도 순천시 중앙로 1',
    complex: null,
    lat: 34.95,
    lng: 127.48,
    exclusiveArea: new Prisma.Decimal('84.97'),
    floor: 7,
    desiredSalePrice: 30000,
    desiredDeposit: null,
    desiredMonthlyRent: null,
    regionCodes: [],
    complexIds: [],
    priceMin: null,
    priceMax: null,
    depositMin: null,
    depositMax: null,
    rentMin: null,
    rentMax: null,
    areaMin: null,
    areaMax: null,
    roomsMin: null,
    moveInDate: new Date('2027-01-15T00:00:00.000Z'),
    description: null,
    photos: [{ media: { id: 'm1', storageKey: 'a.webp', variants: { thumb: { key: 't.webp' } } } }],
    proposalCount: 0,
    expiresAt: null,
    closedAt: null,
    createdAt: NOW,
    ...over,
  };
}

function agencyRow(over: Partial<DealRequestAgencyRow> = {}): DealRequestAgencyRow {
  return {
    ...baseRow(),
    contactScrubbedAt: null,
    targets: [],
    proposals: [],
    contactGrants: [],
    ...over,
  };
}

const contact: DealRequestContactRow = {
  id: '0190a0b0-0000-7000-8000-000000000001',
  contactName: '홍길동',
  contactPhone: '01012345678',
  addressDetail: '101동 1001호',
};

describe('DealRequestMapper', () => {
  it('base view converts decimals/dates and media urls, without contact or 동·호', () => {
    const v = mapper.base(baseRow());
    expect(v.exclusiveArea).toBe(84.97);
    expect(v.moveInDate).toBe('2027-01-15');
    expect(v.photos).toEqual([
      { mediaId: 'm1', url: '/media/large/a.webp', thumbUrl: '/media/thumb/a.webp' },
    ]);
    expect(Object.keys(v)).not.toEqual(expect.arrayContaining(['contactPhone']));
    expect(JSON.stringify(v)).not.toContain('01012345678');
  });

  it('agency view hides contact without an active grant even if contact was passed', () => {
    const v = mapper.agency(agencyRow(), contact);
    expect(v.contact).toBeNull();
    expect(JSON.stringify(v)).not.toContain('1001호');
  });

  it('agency view shows contact with an active grant', () => {
    const v = mapper.agency(agencyRow({ contactGrants: [{ agencyId: AGENCY }] }), contact);
    expect(v.contact).toEqual({
      name: '홍길동',
      phone: '01012345678',
      addressDetail: '101동 1001호',
    });
  });

  it('agency view exposes own proposal + targeted flag', () => {
    const v = mapper.agency(
      agencyRow({
        targets: [{ agencyId: AGENCY }],
        proposals: [{ id: 'p1', status: ProposalStatus.SENT, createdAt: NOW }],
      }),
      null,
    );
    expect(v.targeted).toBe(true);
    expect(v.myProposal).toEqual({ id: 'p1', status: 'SENT', createdAt: NOW.toISOString() });
  });

  it('admin view masks the contact', () => {
    const row: DealRequestAdminRow = {
      ...baseRow(),
      userId: 'u1',
      contactName: '홍길동',
      contactPhone: '01012345678',
      closeReason: null,
      contactScrubbedAt: null,
      deletedAt: null,
      targets: [],
    };
    const v = mapper.admin(row);
    expect(v.contactNameMasked).toBe('홍*동');
    expect(v.contactPhoneMasked).toBe('010-****-5678');
    expect(JSON.stringify(v)).not.toContain('01012345678');
  });
});

describe('canSeeContact', () => {
  const granted = { contactGrants: [{ agencyId: AGENCY }], contactScrubbedAt: null };
  it.each([
    [DealRequestStatus.OPEN, true],
    [DealRequestStatus.MATCHED, true],
    [DealRequestStatus.CLOSED, true],
    [DealRequestStatus.CANCELLED, false],
    [DealRequestStatus.EXPIRED, false],
  ])('%s → %s', (status, expected) => {
    expect(canSeeContact({ ...granted, status })).toBe(expected);
  });

  it('never after scrubbing or without grant', () => {
    expect(
      canSeeContact({ ...granted, status: DealRequestStatus.OPEN, contactScrubbedAt: NOW }),
    ).toBe(false);
    expect(
      canSeeContact({ contactGrants: [], contactScrubbedAt: null, status: DealRequestStatus.OPEN }),
    ).toBe(false);
  });
});

describe('maskName', () => {
  it.each([
    ['홍길동', '홍*동'],
    ['남궁민수', '남**수'],
    ['홍길', '홍*'],
    ['홍', '*'],
    ['', ''],
  ])('%s → %s', (input, out) => expect(maskName(input)).toBe(out));
});

describe('agency visibility', () => {
  const scope = { agencyId: AGENCY, sggCode: '46150' };

  it('covers proposed requests and open region/targeted requests, never deleted ones', () => {
    const w = agencyVisibleWhere(scope, NOW);
    expect(w.deletedAt).toBeNull();
    expect(w.OR).toHaveLength(2);
    expect(JSON.stringify(w)).toContain('"sggCode":"46150"');
    expect(JSON.stringify(w)).toContain(`"targets":{"some":{"agencyId":"${AGENCY}"}}`);
    expect(JSON.stringify(w)).toContain(NOW.toISOString());
  });

  it('applies inbox scopes and filters', () => {
    const w = agencyInboxWhere(
      scope,
      {
        scope: AgencyInboxScope.NEW,
        type: DealRequestType.WANTED,
        assetType: [AssetType.APT],
        dealType: [DealType.JEONSE],
      },
      NOW,
    );
    const and = w.AND as Prisma.DealRequestWhereInput[];
    expect(and).toHaveLength(5);
    expect(and[1]).toEqual({ status: 'OPEN', proposals: { none: { agencyId: AGENCY } } });
    expect(and[4]).toEqual({ dealTypes: { hasSome: ['JEONSE'] } });
  });
});

describe('parseCursor', () => {
  it('round-trips and rejects junk', () => {
    const id = '0190a0b0-0000-7000-8000-000000000001';
    expect(parseCursor(`${NOW.toISOString()}|${id}`)).toEqual({ createdAt: NOW, id });
    expect(parseCursor('garbage')).toBeNull();
    expect(parseCursor(`not-a-date|${id}`)).toBeNull();
    expect(parseCursor(`${NOW.toISOString()}|1 OR 1=1`)).toBeNull();
    expect(parseCursor(null)).toBeNull();
  });
});
