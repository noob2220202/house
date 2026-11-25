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
import {
  adminHistory,
  canSeeContact,
  DealRequestMapper,
  maskName,
  type AdminDealRequestExtras,
} from './deal-request.mapper';
import type {
  DealRequestAdminDetailRow,
  DealRequestAdminRow,
  DealRequestAgencyRow,
  DealRequestBaseRow,
  DealRequestContactRow,
  ProposalOwnerRow,
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
    sggCode: '12150',
    emdCode: '1215010100',
    roadAddress: '전남광주통합특별시 순천시 중앙로 1',
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
    const v = mapper.agency(agencyRow(), contact, NOW);
    expect(v.contact).toBeNull();
    expect(v.detailsShared).toBe(false);
    expect(JSON.stringify(v)).not.toContain('1001호');
  });

  it('agency view before a grant: 읍면동, grid point, area band, flags only — no address, floor, photos, own words', () => {
    const v = mapper.agency(
      agencyRow({
        lat: 34.950123,
        lng: 127.487654,
        description: '· 가격 협의 가능\n\n101동 남향, 올수리',
      }),
      null,
      NOW,
    );
    expect(v).toMatchObject({
      emdCode: '1215010100',
      roadAddress: null,
      lat: 34.951,
      lng: 127.487,
      exclusiveArea: null,
      areaRange: { min: 60, max: 85 },
      floor: null,
      description: '· 가격 협의 가능',
      photos: [],
      photoCount: 1,
      desiredSalePrice: 30000,
      detailsShared: false,
    });
    expect(JSON.stringify(v)).not.toMatch(/중앙로|올수리|a\.webp/);
  });

  it('구하기 requests are not reduced (their conditions are the 제공 항목)', () => {
    const v = mapper.agency(
      agencyRow({ type: DealRequestType.WANTED, description: '역세권 원룸 찾아요' }),
      null,
      NOW,
    );
    expect(v.description).toBe('역세권 원룸 찾아요');
  });

  it('agency view shows contact and the full details with an active grant', () => {
    const v = mapper.agency(agencyRow({ contactGrants: [{ agencyId: AGENCY }] }), contact, NOW);
    expect(v.contact).toEqual({
      name: '홍길동',
      phone: '01012345678',
      addressDetail: '101동 1001호',
    });
    expect(v).toMatchObject({
      detailsShared: true,
      roadAddress: '전남광주통합특별시 순천시 중앙로 1',
      lat: 34.95,
      exclusiveArea: 84.97,
      floor: 7,
      photoCount: 1,
    });
    expect(v.photos).toHaveLength(1);
  });

  it('a granted agency loses contact and details 30 days after the request ended', () => {
    const day = 86_400_000;
    const ended = (days: number) =>
      agencyRow({
        status: DealRequestStatus.CLOSED,
        closedAt: new Date(NOW.getTime() - days * day),
        contactGrants: [{ agencyId: AGENCY }],
      });
    expect(mapper.agency(ended(29), contact, NOW).detailsShared).toBe(true);
    const late = mapper.agency(ended(30), contact, NOW);
    expect(late.contact).toBeNull();
    expect(late.roadAddress).toBeNull();
  });

  it('proposal agent: a 중개보조원 is labelled and never shows their own phone', () => {
    const row = (member: ProposalOwnerRow['member']): ProposalOwnerRow => ({
      id: 'p1',
      dealRequestId: 'r1',
      agencyId: AGENCY,
      status: ProposalStatus.SENT,
      message: '제안',
      suggestedPrice: null,
      suggestedDeposit: null,
      suggestedMonthlyRent: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: NOW,
      member,
      listings: [],
    });
    const m = { displayName: '김보조', phone: '01055556666', status: 'ACTIVE' as const };
    expect(
      mapper.proposalForOwner(row({ ...m, role: 'AGENT', isLicensed: false }), null, false).agent,
    ).toEqual({ displayName: '김보조', isAssistant: true, phone: null });
    expect(
      mapper.proposalForOwner(row({ ...m, role: 'AGENT', isLicensed: true }), null, false).agent,
    ).toEqual({ displayName: '김보조', isAssistant: false, phone: '01055556666' });
    expect(
      mapper.proposalForOwner(row({ ...m, role: 'OWNER', isLicensed: false }), null, false).agent,
    ).toMatchObject({ isAssistant: false });
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
      spamFlaggedAt: null,
      spamReason: null,
      deletedAt: null,
      targets: [],
    };
    const extras: AdminDealRequestExtras = { requester: null, regionNames: new Map() };
    const v = mapper.admin(row, extras);
    expect(v.contactNameMasked).toBe('홍*동');
    expect(v.contactPhoneMasked).toBe('010-****-5678');
    expect(JSON.stringify(v)).not.toContain('01012345678');
    expect(v).toMatchObject({
      spamFlaggedAt: null,
      spamReason: null,
      spamSignalCount: 0,
      spamSignals: [],
    });
    const flagged = mapper.admin({ ...row, spamFlaggedAt: NOW, spamReason: '광고성 요청' }, extras);
    expect(flagged).toMatchObject({ spamFlaggedAt: NOW.toISOString(), spamReason: '광고성 요청' });
  });

  it('admin view carries the requester and region names', () => {
    const row: DealRequestAdminRow = {
      ...baseRow({ emdCode: '12150132', regionCodes: ['12150101', '99999999', '12150132'] }),
      userId: 'u1',
      contactName: '홍길동',
      contactPhone: '01012345678',
      closeReason: null,
      contactScrubbedAt: null,
      spamFlaggedAt: null,
      spamReason: null,
      deletedAt: null,
      targets: [{ agencyId: AGENCY }],
    };
    const requester = {
      id: 'u1',
      nickname: null,
      status: 'ACTIVE' as const,
      createdAt: NOW.toISOString(),
      dealRequestCount: 3,
    };
    const v = mapper.admin(row, {
      requester,
      regionNames: new Map([
        ['12150132', '조례동'],
        ['12150101', '향동'],
      ]),
    });
    expect(v.requester).toEqual(requester);
    expect(v.emdName).toBe('조례동');
    expect(v.regionNames).toEqual(['향동', '조례동']);
  });

  it('admin history: created, proposals, grants, admin actions and the end, newest first', () => {
    const t = (min: number) => new Date(NOW.getTime() + min * 60_000);
    const row: DealRequestAdminDetailRow = {
      ...baseRow({ status: DealRequestStatus.CANCELLED, closedAt: t(50), createdAt: t(0) }),
      userId: 'u1',
      contactName: '',
      contactPhone: '',
      closeReason: null,
      contactScrubbedAt: null,
      spamFlaggedAt: null,
      spamReason: null,
      deletedAt: null,
      targets: [{ agencyId: AGENCY, agency: { name: '순천공인' } }],
      proposals: [
        {
          id: 'p1',
          agencyId: AGENCY,
          status: ProposalStatus.SENT,
          message: '안녕하세요',
          respondedAt: null,
          createdAt: t(10),
          agency: { name: '순천공인' },
          _count: { listings: 2 },
        },
      ],
      contactGrants: [
        { agencyId: AGENCY, grantedAt: t(20), revokedAt: t(50), agency: { name: '순천공인' } },
      ],
    };
    const history = adminHistory(row, [
      {
        id: 'a1',
        action: 'dealRequest.spamFlag',
        after: { spamFlaggedAt: t(30).toISOString(), spamReason: '광고성' },
        createdAt: t(30),
        adminUser: { name: '운영자' },
      },
      {
        id: 'a2',
        action: 'dealRequest.spamFlag',
        after: { spamFlaggedAt: null, spamReason: null },
        createdAt: t(40),
        adminUser: null,
      },
    ]);
    expect(history.map((h) => [h.action, h.actorName, h.note])).toEqual([
      ['DEAL_REQUEST_CANCELLED', null, null],
      ['DEAL_REQUEST_SPAM_CLEARED', null, null],
      ['DEAL_REQUEST_SPAM_FLAGGED', '운영자', '광고성'],
      ['CONTACT_GRANTED', '순천공인', '공개 철회됨'],
      ['PROPOSAL_SENT', '순천공인', null],
      ['DEAL_REQUEST_CREATED', null, null],
    ]);
    expect(
      mapper.adminDetail(row, { requester: null, regionNames: new Map() }, []).contactGrants,
    ).toEqual([]);
  });
});

describe('canSeeContact', () => {
  const granted = {
    contactGrants: [{ agencyId: AGENCY }],
    contactScrubbedAt: null,
    closedAt: null,
  };
  it.each([
    [DealRequestStatus.OPEN, true],
    [DealRequestStatus.MATCHED, true],
    [DealRequestStatus.CLOSED, true],
    [DealRequestStatus.CANCELLED, false],
    [DealRequestStatus.EXPIRED, false],
  ])('%s → %s', (status, expected) => {
    expect(canSeeContact({ ...granted, status }, NOW)).toBe(expected);
  });

  it('never after scrubbing or without grant', () => {
    expect(
      canSeeContact({ ...granted, status: DealRequestStatus.OPEN, contactScrubbedAt: NOW }, NOW),
    ).toBe(false);
    expect(
      canSeeContact(
        {
          contactGrants: [],
          contactScrubbedAt: null,
          closedAt: null,
          status: DealRequestStatus.OPEN,
        },
        NOW,
      ),
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
  const scope = { agencyId: AGENCY, sggCode: '12150' };

  it('covers proposed requests and open region/targeted requests, never deleted or spam-flagged ones', () => {
    const w = agencyVisibleWhere(scope, NOW);
    expect(w.deletedAt).toBeNull();
    expect(w.spamFlaggedAt).toBeNull();
    expect(w.OR).toHaveLength(2);
    expect(JSON.stringify(w)).toContain('"sggCode":"12150"');
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
