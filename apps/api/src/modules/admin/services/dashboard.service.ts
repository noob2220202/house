import {
  type AdminDashboard,
  ADS_ENDING_SOON_DAYS,
  AgencySiteStatus,
  AgencyStatus,
  DealRequestStatus,
  ListingStatus,
  OPEN_REPORT_STATUSES,
  PUBLIC_LISTING_STATUSES,
  ReportStatus,
  UserStatus,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DASHBOARD_CACHE_TTL_SECONDS } from '../constants';
import { VisitorStatsService } from '../visitors/visitor-stats.service';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const ENDING_SOON_LIMIT = 10;
const ALL_REPORT_STATUSES = Object.values(ReportStatus);
const ALL_USER_STATUSES = Object.values(UserStatus);

/** 00:00 KST of the day containing `now`, as a UTC instant. */
export function startOfKstDay(now: Date): Date {
  const kst = now.getTime() + KST_OFFSET_MS;
  return new Date(Math.floor(kst / DAY_MS) * DAY_MS - KST_OFFSET_MS);
}

/**
 * GET /admin/dashboard counters: the shared `AdminDashboard` plus `agencies.sitesPending`
 * (사무소 홈페이지 requests waiting for approval, the sidebar badge `agencySitesPending`).
 */
export type AdminDashboardSummary = AdminDashboard & {
  agencies: AdminDashboard['agencies'] & { sitesPending: number };
};

/**
 * Back-office dashboard: counters across modules (read-only COUNTs on indexed columns) plus the
 * visitor HyperLogLogs. Cached briefly — it is polled by every open admin tab.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly visitors: VisitorStatsService,
  ) {}

  get(now: Date = new Date()): Promise<AdminDashboardSummary> {
    return this.cache.getOrSet('cache:admin:dashboard', DASHBOARD_CACHE_TTL_SECONDS, () =>
      this.compute(now),
    );
  }

  async compute(now: Date = new Date()): Promise<AdminDashboardSummary> {
    const today = startOfKstDay(now);
    const soon = new Date(now.getTime() + ADS_ENDING_SOON_DAYS * DAY_MS);
    const liveBannerWhere: Prisma.BannerWhereInput = {
      deletedAt: null,
      paused: false,
      startAt: { lte: now },
      endAt: { gt: now, lte: soon },
    };
    const db = this.prisma;
    const [
      visitors,
      newListings,
      activeListings,
      hiddenListings,
      newDealRequests,
      openDealRequests,
      pendingAgencies,
      approvedAgencies,
      pendingAgencySites,
      openReports,
      newReports,
      newMembers,
      totalMembers,
      suspendedMembers,
      endingSoon,
      endingSoonCount,
    ] = await Promise.all([
      this.visitors.lastDays(7, now),
      db.listing.count({
        where: {
          deletedAt: null,
          status: { in: [...PUBLIC_LISTING_STATUSES] },
          publishedAt: { gte: today },
        },
      }),
      db.listing.count({
        where: { deletedAt: null, status: { in: [...PUBLIC_LISTING_STATUSES] } },
      }),
      db.listing.count({ where: { deletedAt: null, status: ListingStatus.HIDDEN } }),
      db.dealRequest.count({ where: { createdAt: { gte: today } } }),
      db.dealRequest.count({ where: { status: DealRequestStatus.OPEN } }),
      db.agency.count({ where: { deletedAt: null, status: AgencyStatus.PENDING } }),
      db.agency.count({ where: { deletedAt: null, status: AgencyStatus.APPROVED } }),
      db.agencySite.count({
        where: { status: AgencySiteStatus.REQUESTED, agency: { deletedAt: null } },
      }),
      db.report.count({ where: { status: { in: [...OPEN_REPORT_STATUSES] } } }),
      // `status IN (all)` lets Postgres use the (status, created_at) indexes for the date range.
      db.report.count({
        where: { status: { in: ALL_REPORT_STATUSES }, createdAt: { gte: today } },
      }),
      db.user.count({ where: { status: { in: ALL_USER_STATUSES }, createdAt: { gte: today } } }),
      db.user.count({ where: { status: { not: UserStatus.WITHDRAWN } } }),
      db.user.count({ where: { status: UserStatus.SUSPENDED } }),
      db.banner.findMany({
        where: liveBannerWhere,
        orderBy: { endAt: 'asc' },
        take: ENDING_SOON_LIMIT,
        select: { id: true, title: true, slot: true, endAt: true },
      }),
      db.banner.count({ where: liveBannerWhere }),
    ]);
    const daily = visitors.daily;
    return {
      generatedAt: now.toISOString(),
      visitors: {
        today: daily[daily.length - 1]?.count ?? 0,
        yesterday: daily[daily.length - 2]?.count ?? 0,
        last7Days: daily,
        uniqueLast7Days: visitors.unique,
      },
      listings: { newToday: newListings, active: activeListings, hidden: hiddenListings },
      dealRequests: { newToday: newDealRequests, open: openDealRequests },
      agencies: {
        pending: pendingAgencies,
        approved: approvedAgencies,
        sitesPending: pendingAgencySites,
      },
      reports: { open: openReports, newToday: newReports },
      members: { newToday: newMembers, total: totalMembers, suspended: suspendedMembers },
      ads: {
        endingSoon: endingSoon.map((b) => ({
          id: b.id,
          title: b.title,
          slot: b.slot,
          endAt: b.endAt.toISOString(),
        })),
        endingSoonCount,
      },
    };
  }
}
