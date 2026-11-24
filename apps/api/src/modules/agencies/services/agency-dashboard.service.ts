import { AgencyStatus, ListingAgencyStatus, ListingStatus } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DASHBOARD_EXPIRING_WITHIN_DAYS,
  DASHBOARD_LIST_LIMIT,
  DASHBOARD_VERIFICATION_SOON_DAYS,
  LISTING_VERIFICATION_VALID_DAYS,
} from '../constants';
import {
  addDays,
  dailyViews,
  dayToDate,
  kstDay,
  toDashboardListing,
  type DailyViews,
  type DashboardListing,
  type DashboardListingRow,
} from '../domain/dashboard';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Listing / views part of `GET /agencies/mine/dashboard` (the request feed is added by deal-requests). */
export interface AgencyListingDashboard {
  listings: {
    active: number;
    reserved: number;
    draft: number;
    /** 거래완료 in the last 30 days. */
    closed30d: number;
    /** Live (ACTIVE/RESERVED) listings this agency co-brokers for another primary agency. */
    coBrokered: number;
  };
  views: DailyViews & { profileViews7d: number; favorites7d: number };
  expiringListings: DashboardListing[];
  verificationDue: DashboardListing[];
}

interface CountsRow {
  active: number;
  reserved: number;
  draft: number;
  closed30d: number;
  coBrokered: number;
}

const LIVE_STATUSES = [ListingStatus.ACTIVE, ListingStatus.RESERVED];

const dashboardListingSelect = {
  id: true,
  title: true,
  assetType: true,
  dealType: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  presalePrice: true,
  premium: true,
  floorDisplay: true,
  expiresAt: true,
  verifiedAt: true,
  complex: { select: { name: true } },
  property: {
    select: { floor: true, totalFloors: true, exclusiveArea: true, supplyArea: true },
  },
} satisfies Prisma.ListingSelect;

/**
 * Console home numbers of one agency: listing counters, 7-day listing views (daily snapshots in
 * `agency_daily_stats`), favorites, ads about to expire and listings whose 실매물 확인 is due.
 * Reads the listing tables read-only (ListingsModule exposes no such reader).
 */
@Injectable()
export class AgencyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async listingDashboard(
    agencyId: string,
    now: Date = new Date(),
  ): Promise<AgencyListingDashboard> {
    const today = kstDay(now);
    await this.snapshot(now, agencyId);
    const [counts, snapshots, favorites7d, expiringListings, verificationDue] = await Promise.all([
      this.counts(agencyId, now),
      this.snapshots(agencyId, today),
      this.favorites7d(agencyId, now),
      this.expiring(agencyId, now),
      this.verificationDue(agencyId, now),
    ]);
    return {
      listings: counts,
      views: {
        ...dailyViews(snapshots, today),
        // 중개사무소 프로필 조회는 아직 집계하지 않는다 (README "Dashboard").
        profileViews7d: 0,
        favorites7d,
      },
      expiringListings,
      verificationDue,
    };
  }

  /**
   * Upserts today's cumulative listing views of every APPROVED agency (or one), so the chart has a
   * baseline per day. Idempotent; the hourly job and each dashboard read call it.
   */
  async snapshot(now: Date = new Date(), agencyId?: string): Promise<number> {
    const day = dayToDate(kstDay(now));
    const only = agencyId ? Prisma.sql`AND a.id = ${agencyId}::uuid` : Prisma.empty;
    return this.prisma.$executeRaw`
      INSERT INTO agency_daily_stats (agency_id, day, listing_views, updated_at)
      SELECT a.id, ${day}::date, COALESCE(SUM(l.view_count), 0)::int, now()
      FROM agencies a
      LEFT JOIN listing_agencies la
        ON la.agency_id = a.id AND la.status = ${ListingAgencyStatus.ACTIVE}::listing_agency_status
      LEFT JOIN listings l ON l.id = la.listing_id AND l.deleted_at IS NULL
      WHERE a.status = ${AgencyStatus.APPROVED}::agency_status AND a.deleted_at IS NULL ${only}
      GROUP BY a.id
      ON CONFLICT (agency_id, day)
      DO UPDATE SET listing_views = EXCLUDED.listing_views, updated_at = now()`;
  }

  private async counts(agencyId: string, now: Date): Promise<CountsRow> {
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const [row] = await this.prisma.$queryRaw<CountsRow[]>`
      SELECT
        count(*) FILTER (WHERE l.status = 'ACTIVE'::listing_status)::int AS active,
        count(*) FILTER (WHERE l.status = 'RESERVED'::listing_status)::int AS reserved,
        count(*) FILTER (WHERE l.status = 'DRAFT'::listing_status)::int AS draft,
        count(*) FILTER (WHERE l.status = 'CLOSED'::listing_status AND l.closed_at >= ${since})::int
          AS "closed30d",
        count(*) FILTER (WHERE NOT la.is_primary
          AND l.status IN ('ACTIVE'::listing_status, 'RESERVED'::listing_status))::int AS "coBrokered"
      FROM listing_agencies la
      JOIN listings l ON l.id = la.listing_id
      WHERE la.agency_id = ${agencyId}::uuid
        AND la.status = ${ListingAgencyStatus.ACTIVE}::listing_agency_status
        AND l.deleted_at IS NULL`;
    return row ?? { active: 0, reserved: 0, draft: 0, closed30d: 0, coBrokered: 0 };
  }

  /** Snapshots of the last 15 days (7 shown + 7 compared + 1 baseline). */
  private async snapshots(agencyId: string, today: string): Promise<Map<string, number>> {
    const rows = await this.prisma.agencyDailyStat.findMany({
      where: { agencyId, day: { gte: dayToDate(addDays(today, -14)), lte: dayToDate(today) } },
      select: { day: true, listingViews: true },
    });
    return new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r.listingViews]));
  }

  private favorites7d(agencyId: string, now: Date): Promise<number> {
    return this.prisma.favoriteListing.count({
      where: {
        createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
        listing: {
          deletedAt: null,
          agencies: { some: { agencyId, status: ListingAgencyStatus.ACTIVE } },
        },
      },
    });
  }

  /** Live ads of the primary agency that lapse within a week, soonest first. */
  private async expiring(agencyId: string, now: Date): Promise<DashboardListing[]> {
    const rows = await this.prisma.listing.findMany({
      where: {
        primaryAgencyId: agencyId,
        deletedAt: null,
        status: { in: LIVE_STATUSES },
        expiresAt: {
          gte: now,
          lte: new Date(now.getTime() + DASHBOARD_EXPIRING_WITHIN_DAYS * DAY_MS),
        },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: DASHBOARD_LIST_LIMIT,
      select: dashboardListingSelect,
    });
    return rows.map((r) => toDashboardListing(toRow(r), LISTING_VERIFICATION_VALID_DAYS));
  }

  /**
   * Live listings of the primary agency never verified, or whose last 실매물 확인 runs out within
   * a week (or already did); never verified and oldest first.
   */
  private async verificationDue(agencyId: string, now: Date): Promise<DashboardListing[]> {
    const staleBefore = new Date(
      now.getTime() - (LISTING_VERIFICATION_VALID_DAYS - DASHBOARD_VERIFICATION_SOON_DAYS) * DAY_MS,
    );
    const rows = await this.prisma.listing.findMany({
      where: {
        primaryAgencyId: agencyId,
        deletedAt: null,
        status: { in: LIVE_STATUSES },
        OR: [{ verifiedAt: null }, { verifiedAt: { lte: staleBefore } }],
      },
      orderBy: [{ verifiedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: DASHBOARD_LIST_LIMIT,
      select: dashboardListingSelect,
    });
    return rows.map((r) => toDashboardListing(toRow(r), LISTING_VERIFICATION_VALID_DAYS));
  }
}

type SelectedRow = Prisma.ListingGetPayload<{ select: typeof dashboardListingSelect }>;

function toRow(r: SelectedRow): DashboardListingRow {
  return {
    ...r,
    property: {
      floor: r.property.floor,
      totalFloors: r.property.totalFloors,
      exclusiveArea: decimalToNumber(r.property.exclusiveArea),
      supplyArea: decimalToNumber(r.property.supplyArea),
    },
  };
}
