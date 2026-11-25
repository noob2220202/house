import { describe, expect, it } from 'vitest';
import type { AdminDealRequestDetailView, AdminReportView } from '@house/shared';
import {
  agenciesDb,
  toAgencyDetailView,
  toAgencyListItem,
  toRegistryCheckView,
} from '@/app/mock-api/v1/admin/agencies/_fixtures';
import {
  dealRequestsDb,
  toDealRequestListItem,
} from '@/app/mock-api/v1/admin/deal-requests/_fixtures';
import { listingsDb, toListingListItem } from '@/app/mock-api/v1/admin/listings/_fixtures';
import {
  reportsDb,
  toReportDetail,
  toReportListItem,
} from '@/app/mock-api/v1/admin/reports/_fixtures';
import { toUserListItem, usersDb } from '@/app/mock-api/v1/admin/users/_fixtures';
import {
  adminAgencyDetailSchema,
  adminAgencyListItemSchema,
  adminDealRequestDetailSchema,
  adminDealRequestListItemSchema,
  adminListingDetailSchema,
  adminListingListItemSchema,
  adminReportDetailSchema,
  adminReportListItemSchema,
  adminUserDetailSchema,
  adminUserListItemSchema,
  pageOf,
  registryCheckSchema,
} from './schemas';

const T = '2026-11-20T01:00:00.000Z';

/** JSON round-trip = what actually travels over the wire (drops `undefined`, keeps `null`). */
const wire = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

/**
 * The mock API and the screens must agree on one contract: every fixture row has to parse with the
 * schema the API client uses for that endpoint.
 */
describe('moderation mock fixtures match the response schemas', () => {
  it('agencies', () => {
    const rows = agenciesDb();
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(adminAgencyDetailSchema.safeParse(wire(row)).error).toBeUndefined();
      expect(
        adminAgencyListItemSchema.safeParse(wire(toAgencyListItem(row))).error,
      ).toBeUndefined();
    }
  });
  it('listings', () => {
    const rows = listingsDb();
    expect(rows.length).toBeGreaterThan(15);
    for (const row of rows) {
      expect(adminListingDetailSchema.safeParse(wire(row)).error).toBeUndefined();
      expect(
        adminListingListItemSchema.safeParse(wire(toListingListItem(row))).error,
      ).toBeUndefined();
    }
  });
  it('reports', () => {
    const rows = reportsDb();
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(adminReportDetailSchema.safeParse(wire(toReportDetail(row))).error).toBeUndefined();
      expect(
        adminReportListItemSchema.safeParse(wire(toReportListItem(row))).error,
      ).toBeUndefined();
    }
  });
  it('deal requests', () => {
    const rows = dealRequestsDb();
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(adminDealRequestDetailSchema.safeParse(wire(row)).error).toBeUndefined();
      expect(
        adminDealRequestListItemSchema.safeParse(wire(toDealRequestListItem(row))).error,
      ).toBeUndefined();
    }
  });
  it('users', () => {
    const rows = usersDb();
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expect(adminUserDetailSchema.safeParse(wire(row)).error).toBeUndefined();
      expect(adminUserListItemSchema.safeParse(wire(toUserListItem(row))).error).toBeUndefined();
    }
  });
});

describe('agency views of the real API (shared AdminAgency* / AgencyRegistryCheck)', () => {
  it('maps AdminAgencyDetail onto the detail model', () => {
    const row = agenciesDb().find((a) => a.warnings.length > 0 && a.statusHistory.length > 1)!;
    const parsed = adminAgencyDetailSchema.parse(wire(toAgencyDetailView(row)));
    expect(parsed.documents[0]?.fileName).toBe(row.documents[0]?.fileName);
    expect(parsed.documentTypes).toEqual([...new Set(row.documents.map((d) => d.type))]);
    expect(parsed.statusHistory[0]?.decidedByName).toBe(row.statusHistory[0]?.decidedByName);
    expect(parsed.warnings).toHaveLength(row.warnings.length);
    // no registry check in the detail: loaded from GET …/registry-check
    expect(parsed.registryCheck ?? null).toBeNull();
  });

  it('keeps unknown list fields unknown instead of inventing zeros', () => {
    const parsed = adminAgencyListItemSchema.parse(wire(toAgencyListItem(agenciesDb()[0]!)));
    expect(parsed.documentTypes).toBeNull();
    expect(parsed.activeListingCount).toBeNull();
    expect(parsed.documentCount).toBeGreaterThan(0);
  });

  it('maps AgencyRegistryCheck (MATCH, record, officeName…) onto the panel model', () => {
    const parsed = registryCheckSchema.parse({
      status: 'MISMATCH',
      checkedAt: '2026-11-24T01:00:00.000Z',
      record: {
        registrationNumber: '46150-2020-00012',
        officeName: '연향 공인중개사사무소',
        representativeName: '김○○',
        operating: true,
        statusLabel: '영업중',
        regionName: '순천시',
        registeredOn: '2020-03-02',
      },
      mismatches: ['representativeName', 'officeName'],
    });
    expect(parsed).toMatchObject({
      status: 'MISMATCH',
      registry: {
        name: '연향 공인중개사사무소',
        businessStatus: '영업중',
        registeredAt: '2020-03-02',
      },
      mismatches: ['representativeName', 'name'],
    });
    expect(
      registryCheckSchema.parse({
        status: 'MATCH',
        checkedAt: '2026-11-24T01:00:00.000Z',
        record: null,
        mismatches: [],
      }).status,
    ).toBe('MATCHED');
    for (const row of agenciesDb())
      if (row.registryCheck)
        expect(registryCheckSchema.safeParse(toRegistryCheckView(row.registryCheck)).success).toBe(
          true,
        );
  });
});

describe('other real admin views', () => {
  it('maps AdminListingDetail (agencies[].id, recentReports)', () => {
    const parsed = adminListingDetailSchema.parse({
      id: 'l1',
      status: 'ACTIVE',
      dealType: 'SALE',
      assetType: 'APT',
      title: '연향 센트럴 32평',
      roadAddress: '순천시 연향로 1',
      complexId: null,
      primaryAgency: { id: 'a1', name: '연향 공인중개사사무소' },
      salePrice: 31000,
      deposit: null,
      monthlyRent: null,
      hiddenReason: null,
      openReportCount: 1,
      viewCount: 10,
      publishedAt: T,
      closedAt: null,
      createdAt: T,
      updatedAt: T,
      description: null,
      verifiedAt: null,
      photoCount: 3,
      agencies: [{ id: 'a1', name: '연향 공인중개사사무소', isPrimary: true }],
      recentReports: [{ id: 'r1', reason: 'NOT_EXIST', status: 'RECEIVED', createdAt: T }],
    });
    expect(parsed.agencies[0]).toMatchObject({ agencyId: 'a1', isPrimary: true });
    expect(parsed.reports).toHaveLength(1);
    expect(parsed.agencyCount).toBe(1);
  });

  it('parses AdminReportView as the API sends it (listing target card fields)', () => {
    const view: AdminReportView = {
      id: 'r1',
      targetType: 'LISTING',
      listing: {
        id: 'l1',
        status: 'RESERVED',
        title: '오천 리버하임 34평 고층',
        roadAddress: '전남광주통합특별시 순천시 오천강변길 52',
        assetType: 'APT',
        dealType: 'JEONSE',
        salePrice: null,
        deposit: 25000,
        monthlyRent: null,
        presalePrice: null,
        premium: null,
        complexName: '오천 리버하임',
        dong: '103',
        buildingName: null,
        exclusiveArea: 84.9,
        supplyArea: 112.4,
        floorClass: 'HIGH',
        floor: 18,
        totalFloors: 25,
        verifiedAt: T,
        publishedAt: T,
        photoCount: 6,
      },
      agency: { id: 'a1', name: '오천그린공인중개사사무소', status: 'APPROVED', warningCount: 0 },
      reporter: { id: 'u1', nickname: null, status: 'ACTIVE', reportCount: 3, upheldCount: 1 },
      sameTargetCount: 2,
      reporterPhone: null,
      reason: 'ALREADY_DEALT',
      detail: '이미 거래가 끝난 매물입니다.',
      status: 'RECEIVED',
      action: null,
      resolutionNote: null,
      handledBy: null,
      handledAt: null,
      createdAt: T,
      updatedAt: T,
    };
    const parsed = adminReportDetailSchema.parse(view);
    expect(parsed.listing).toMatchObject({
      dealType: 'JEONSE',
      deposit: 25000,
      complexName: '오천 리버하임',
      photoCount: 6,
    });
    expect(adminReportListItemSchema.parse(view).listing?.dealType).toBe('JEONSE');
    expect(parsed.reporter).toMatchObject({ status: 'ACTIVE', reportCount: 3, upheldCount: 1 });
    expect(parsed.sameTargetCount).toBe(2);
  });

  it('maps AdminDealRequestView (complex, targets, masked contact, userId)', () => {
    const parsed = adminDealRequestDetailSchema.parse({
      id: 'd1',
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      visibility: 'SELECTED_AGENCIES',
      sggCode: '12150',
      emdCode: null,
      roadAddress: null,
      complex: { id: 'c1', name: '신대 레이크파크' },
      lat: null,
      lng: null,
      exclusiveArea: 84.9,
      floor: 12,
      desiredSalePrice: 42000,
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
      moveInDate: null,
      description: null,
      photos: [],
      proposalCount: 2,
      expiresAt: null,
      closedAt: null,
      createdAt: T,
      userId: 'u1',
      contactNameMasked: '김*수',
      contactPhoneMasked: '010-****-5678',
      targetAgencyIds: ['a1', 'a2'],
      closeReason: null,
      contactScrubbedAt: null,
      deletedAt: null,
    });
    expect(parsed).toMatchObject({
      complexName: '신대 레이크파크',
      targetAgencyCount: 2,
      contactName: '김*수',
      contactPhone: '010-****-5678',
      requester: { id: 'u1' },
    });
    // An older response without `requester` never reads as withdrawn.
    expect(parsed.requester?.status).toBeUndefined();
  });

  it('keeps the API requester summary, region names, offices and history', () => {
    const view: AdminDealRequestDetailView = {
      id: 'd2',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      visibility: 'ALL_AGENCIES_IN_REGION',
      sggCode: '12150',
      emdCode: null,
      roadAddress: null,
      complex: null,
      lat: null,
      lng: null,
      exclusiveArea: null,
      floor: null,
      desiredSalePrice: null,
      desiredDeposit: null,
      desiredMonthlyRent: null,
      regionCodes: ['12150101'],
      complexIds: [],
      priceMin: null,
      priceMax: 30000,
      depositMin: null,
      depositMax: null,
      rentMin: null,
      rentMax: null,
      areaMin: null,
      areaMax: null,
      roomsMin: null,
      moveInDate: null,
      description: null,
      photos: [],
      proposalCount: 1,
      expiresAt: null,
      closedAt: null,
      createdAt: T,
      userId: 'u2',
      requester: {
        id: 'u2',
        nickname: null,
        status: 'ACTIVE',
        createdAt: T,
        dealRequestCount: 2,
      },
      emdName: null,
      regionNames: ['향동'],
      contactNameMasked: '김*수',
      contactPhoneMasked: '010-****-5678',
      targetAgencyIds: ['a1'],
      closeReason: null,
      contactScrubbedAt: null,
      deletedAt: null,
      targets: [{ agencyId: 'a1', name: '순천공인' }],
      proposals: [
        {
          id: 'p1',
          agencyId: 'a1',
          agencyName: '순천공인',
          status: 'SENT',
          message: '추천 매물',
          listingCount: 1,
          createdAt: T,
        },
      ],
      contactGrants: [],
      history: [
        { id: 'h1', action: 'DEAL_REQUEST_CREATED', actorName: null, note: null, createdAt: T },
      ],
    };
    const parsed = adminDealRequestDetailSchema.parse(view);
    expect(parsed.requester).toEqual(view.requester);
    expect(parsed.regionNames).toEqual(['향동']);
    expect(parsed.targets).toEqual([{ agencyId: 'a1', name: '순천공인' }]);
    expect(parsed.proposals[0]).toMatchObject({ agencyName: '순천공인', listingCount: 1 });
    expect(parsed.history).toHaveLength(1);
    expect(adminDealRequestListItemSchema.parse(view).requester).toMatchObject({
      status: 'ACTIVE',
      nickname: null,
    });
  });

  it('maps MemberDetail (identities without id, memberships, counts)', () => {
    const parsed = adminUserDetailSchema.parse({
      id: 'u1',
      nickname: '순천댁',
      name: null,
      email: 'a@example.com',
      phone: null,
      role: 'AGENT',
      status: 'ACTIVE',
      createdAt: T,
      lastLoginAt: null,
      marketingOptIn: false,
      suspendedAt: null,
      suspendedReason: null,
      withdrawnAt: null,
      withdrawalReason: null,
      piiScrubbedAt: null,
      identities: [{ provider: 'KAKAO', createdAt: T, lastUsedAt: null }],
      memberships: [
        {
          agencyId: 'a1',
          agencyName: '연향 공인중개사사무소',
          agencyStatus: 'APPROVED',
          role: 'AGENT',
          status: 'ACTIVE',
        },
      ],
      counts: { dealRequests: 1, reports: 2, favoriteListings: 3 },
      activeSessions: 1,
    });
    expect(parsed.identities[0]).toMatchObject({ id: 'KAKAO', provider: 'KAKAO' });
    expect(parsed.providers).toEqual(['KAKAO']);
    expect(parsed.agency).toMatchObject({ id: 'a1', memberRole: 'AGENT', status: 'APPROVED' });
    expect(parsed.activity).toEqual({
      dealRequestCount: 1,
      reportCount: 2,
      favoriteCount: 3,
      activeSessionCount: 1,
    });
  });
});

describe('fixture integrity', () => {
  it('every report points at an existing listing or agency and an existing reporter', () => {
    const listings = new Set(listingsDb().map((l) => l.id));
    const agencies = new Set(agenciesDb().map((a) => a.id));
    const users = new Set(usersDb().map((u) => u.id));
    for (const report of reportsDb()) {
      if (report.targetType === 'LISTING') expect(listings.has(report.listingId ?? '')).toBe(true);
      else expect(agencies.has(report.agencyId ?? '')).toBe(true);
      expect(users.has(report.reporterUserId)).toBe(true);
    }
  });
  it('open-report counters on listings match the reports table', () => {
    for (const listing of listingsDb()) {
      const open = reportsDb().filter(
        (r) => r.listingId === listing.id && (r.status === 'RECEIVED' || r.status === 'IN_REVIEW'),
      ).length;
      expect(listing.openReportCount, listing.id).toBe(open);
      expect(listing.reviewFlags.includes('REPORTED'), listing.id).toBe(open > 0);
    }
  });
  it('deal requests reference existing members and offices', () => {
    const agencies = new Set(agenciesDb().map((a) => a.id));
    const users = new Set(usersDb().map((u) => u.id));
    for (const request of dealRequestsDb()) {
      expect(users.has(request.requester?.id ?? '')).toBe(true);
      for (const target of request.targets) expect(agencies.has(target.agencyId)).toBe(true);
      for (const proposal of request.proposals) expect(agencies.has(proposal.agencyId)).toBe(true);
      expect(request.targetAgencyCount).toBe(request.targets.length);
      expect(request.proposalCount).toBe(request.proposals.length);
    }
  });
});

describe('pageOf', () => {
  it('parses the backend pagination envelope', () => {
    const schema = pageOf(adminUserListItemSchema);
    const items = usersDb().slice(0, 2).map(toUserListItem);
    const page = schema.parse(wire({ items, page: 1, pageSize: 2, total: 50, totalPages: 25 }));
    expect(page.items).toHaveLength(2);
    expect(schema.safeParse({ items: [] }).success).toBe(false);
  });
});
