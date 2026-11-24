import { describe, expect, it } from 'vitest';
import { agenciesDb, toAgencyListItem } from '@/app/mock-api/v1/admin/agencies/_fixtures';
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
} from './schemas';

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
