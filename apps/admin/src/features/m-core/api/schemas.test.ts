import { describe, expect, it } from 'vitest';
import { mockQueues, mockSummary } from '@/app/mock-api/v1/admin/dashboard/_fixtures';
import { mockCoreState, resetMockCoreState } from '@/app/mock-api/v1/admin/dashboard/_store';
import {
  SEARCH_AGENCIES,
  SEARCH_LISTINGS,
  SEARCH_USERS,
} from '@/app/mock-api/v1/admin/search/_fixtures';
import {
  adminAccountSchema,
  adminLoginResultSchema,
  adminNotificationPageSchema,
  adminNotificationSchema,
  adminSearchSchema,
  dashboardQueuesSchema,
  dashboardSummarySchema,
  adminSessionResultSchema,
  totpActivateResultSchema,
  totpSetupSchema,
  trafficStatsSchema,
} from './schemas';

/**
 * Contract tests: the mock fixtures must satisfy the same zod schemas the pages parse real
 * responses with — when a schema changes, the mock (and the integration doc) has to follow.
 */
describe('m-core schemas ↔ mock fixtures', () => {
  const now = Date.parse('2026-11-23T05:20:00Z');

  it('parses the dashboard summary', () => {
    resetMockCoreState();
    const summary = dashboardSummarySchema.parse(mockSummary({ now }));
    expect(summary.kpis.visitors).toEqual({ today: 3482, yesterday: 3206 });
    expect(summary.badges.agenciesPending).toBe(4);
    expect(summary.kpis.pendingAgencies).toEqual({
      count: 4,
      oldestWaitingDays: 3,
      needsDocuments: 1,
    });
    expect(summary.notificationsUnread).toBe(8);
    // 카카오 · 네이버 · Google only
    expect(summary.socialLogin.map((p) => p.provider)).toEqual(['KAKAO', 'NAVER', 'GOOGLE']);
  });

  it('parses the dashboard queues', () => {
    const queues = dashboardQueuesSchema.parse(mockQueues({ now }));
    expect(queues.pendingAgencies.items).toHaveLength(4);
    expect(queues.dealRequests.items).toHaveLength(5);
    expect(queues.reports).toMatchObject({ total: 3, handledThisWeek: 14, avgHandleHours: 5 });
    expect(queues.expiringAds.items.map((a) => a.advertiserName)).toEqual([
      '신대중앙 공인중개사사무소',
      '선월 분양권 공인중개사사무소',
      '연향들 더 퍼스트',
    ]);
    // nothing in the queues is dated in the future
    for (const r of queues.dealRequests.items) expect(Date.parse(r.createdAt)).toBeLessThan(now);
    for (const a of queues.pendingAgencies.items) expect(Date.parse(a.appliedAt)).toBeLessThan(now);
  });

  it('prefers the queue of the agencies resource when it is available', () => {
    const pending = {
      total: 9,
      items: [
        {
          id: 'a-1',
          name: '테스트 공인중개사사무소',
          areaName: null,
          representativeName: '김테스트',
          registrationNumber: '46150-2026-00001',
          status: 'PENDING',
          appliedAt: '2026-11-18T01:00:00Z',
          documents: {
            submitted: 2,
            required: 3,
            missing: ['BUSINESS_REG_CERT'],
            missingLabel: null,
          },
          registryStatus: 'MATCHED',
        },
      ],
    };
    const summary = dashboardSummarySchema.parse(mockSummary({ now, pending }));
    expect(summary.badges.agenciesPending).toBe(9);
    expect(summary.kpis.pendingAgencies).toEqual({
      count: 9,
      oldestWaitingDays: 5,
      needsDocuments: 1,
    });
    expect(dashboardQueuesSchema.parse(mockQueues({ now, pending })).pendingAgencies.total).toBe(9);
  });

  it('fills defaults for an almost empty payload', () => {
    const summary = dashboardSummarySchema.parse({
      generatedAt: '2026-11-23T05:20:00Z',
      kpis: {
        visitors: { today: 0, yesterday: 0 },
        newListings: { today: 0, yesterday: 0, pendingReview: 0 },
        dealRequests: { today: 0, sell: 0, find: 0, unassigned: 0 },
        pendingAgencies: { count: 0, oldestWaitingDays: null, needsDocuments: 0 },
      },
    });
    expect(summary.badges).toEqual({
      listingsPending: 0,
      agenciesPending: 0,
      dealRequestsOpen: 0,
      reportsOpen: 0,
      agencySitesPending: 0,
    });
    expect(summary.socialLogin).toEqual([]);
    expect(dashboardQueuesSchema.parse({})).toEqual({
      pendingAgencies: { total: 0, items: [] },
      pendingAgencySites: { total: 0, items: [] },
      dealRequests: { total: 0, items: [] },
      reports: { total: 0, items: [], handledThisWeek: 0, avgHandleHours: null },
      expiringAds: { total: 0, items: [] },
    });
    expect(trafficStatsSchema.parse({ days: 7, points: [] }).signupsByProvider).toEqual([]);
  });

  it('carries the 사무소 홈페이지 queue and badge', () => {
    const pendingSites = {
      total: 3,
      items: [
        {
          agencyId: 'a-1',
          agencyName: '테스트 공인중개사사무소',
          requestedSlug: 'test-office',
          requestedAt: '2026-11-20T01:00:00Z',
        },
      ],
    };
    expect(dashboardSummarySchema.parse(mockSummary({ now, pendingSites })).badges).toMatchObject({
      agencySitesPending: 3,
    });
    const queues = dashboardQueuesSchema.parse(mockQueues({ now, pendingSites }));
    expect(queues.pendingAgencySites).toEqual(pendingSites);
    // local fallback: two requests, oldest first
    const local = dashboardQueuesSchema.parse(mockQueues({ now })).pendingAgencySites;
    expect(local.items.map((i) => i.requestedSlug)).toEqual(['hosupark', 'yeonhyang-central']);
  });

  it('reads the site badge from the shared AdminDashboard', () => {
    const base = {
      generatedAt: '2026-11-23T05:20:00Z',
      visitors: { today: 1, yesterday: 1 },
      agencies: { pending: 2, approved: 10 },
    };
    expect(
      dashboardSummarySchema.parse({ ...base, agencySites: { pending: 4 } }).badges
        .agencySitesPending,
    ).toBe(4);
    expect(
      dashboardSummarySchema.parse({
        ...base,
        agencies: { pending: 2, approved: 10, sitesPending: 5 },
      }).badges.agencySitesPending,
    ).toBe(5);
    expect(dashboardSummarySchema.parse(base).badges.agencySitesPending).toBe(0);
  });

  it('rejects a provider the product does not support', () => {
    const bad = {
      ...mockSummary({ now }),
      socialLogin: [{ provider: 'APPLE', enabled: true, healthy: true }],
    };
    expect(dashboardSummarySchema.safeParse(bad).success).toBe(false);
  });

  it('parses the search corpus', () => {
    const result = adminSearchSchema.parse({
      query: '신대',
      listings: { total: SEARCH_LISTINGS.length, items: SEARCH_LISTINGS },
      agencies: { total: SEARCH_AGENCIES.length, items: SEARCH_AGENCIES },
      users: { total: SEARCH_USERS.length, items: SEARCH_USERS },
    });
    expect(result.listings.items.length).toBeGreaterThan(5);
    // member contact details arrive masked
    for (const user of result.users.items) {
      if (user.phone) expect(user.phone).toMatch(/\*/);
      if (user.email) expect(user.email).toMatch(/\*/);
    }
  });

  it('parses the notification feed and tolerates unknown kinds', () => {
    resetMockCoreState();
    const items = mockCoreState().notifications.map(({ minutesAgo, read, ...n }) => ({
      ...n,
      createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
      readAt: read ? new Date(now).toISOString() : null,
    }));
    const page = adminNotificationPageSchema.parse({ items, nextCursor: null, unreadCount: 8 });
    expect(page.items).toHaveLength(30);
    expect(page.items.filter((n) => !n.readAt)).toHaveLength(8);
    expect(
      adminNotificationSchema.parse({
        id: 'n-1',
        kind: 'SOMETHING_NEW',
        title: '새 종류의 알림',
        createdAt: '2026-11-23T05:00:00Z',
      }),
    ).toMatchObject({ kind: 'SYSTEM', body: null, link: null, readAt: null });
  });

  it('parses the auth responses (shared Admin*Response)', () => {
    expect(
      adminLoginResultSchema.parse({ mfaRequired: true, totpEnrolled: false, csrfToken: 't' }),
    ).toEqual({ mfaRequired: true, totpEnrolled: false, csrfToken: 't' });
    expect(adminLoginResultSchema.safeParse({}).success).toBe(false);
    expect(
      totpSetupSchema.safeParse({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP',
        expiresInSeconds: 600,
      }).success,
    ).toBe(true);
    expect(
      totpSetupSchema.safeParse({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'https://example.com' })
        .success,
    ).toBe(false);
    const admin = {
      id: '1',
      email: 'super@example.com',
      name: '정다은',
      role: 'SUPER_ADMIN',
      totpEnabled: true,
      recoveryCodesRemaining: 7,
      lastLoginAt: null,
      lastLoginIp: null,
    };
    expect(adminSessionResultSchema.parse({ admin, csrfToken: 't' }).admin).toMatchObject({
      recoveryCodesRemaining: 7,
      mfaVerified: true,
    });
    expect(adminSessionResultSchema.safeParse({ admin }).success).toBe(false);
    expect(
      totpActivateResultSchema.parse({ admin, csrfToken: 't', recoveryCodes: ['AAAA-BBBB'] })
        .recoveryCodes,
    ).toEqual(['AAAA-BBBB']);
    expect(
      adminAccountSchema.parse({
        id: '1',
        email: 'super@example.com',
        name: '정다은',
        role: 'SUPER_ADMIN',
      }),
    ).toMatchObject({ mfaVerified: true, totpEnabled: true, recoveryCodesRemaining: 0 });
  });
});
