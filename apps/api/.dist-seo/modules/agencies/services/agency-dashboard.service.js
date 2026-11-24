"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyDashboardService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const dashboard_1 = require("../domain/dashboard");
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_STATUSES = [shared_1.ListingStatus.ACTIVE, shared_1.ListingStatus.RESERVED];
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
};
/**
 * Console home numbers of one agency: listing counters, 7-day listing views (daily snapshots in
 * `agency_daily_stats`), favorites, ads about to expire and listings whose 실매물 확인 is due.
 * Reads the listing tables read-only (ListingsModule exposes no such reader).
 */
let AgencyDashboardService = class AgencyDashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listingDashboard(agencyId, now = new Date()) {
        const today = (0, dashboard_1.kstDay)(now);
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
                ...(0, dashboard_1.dailyViews)(snapshots, today),
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
    async snapshot(now = new Date(), agencyId) {
        const day = (0, dashboard_1.dayToDate)((0, dashboard_1.kstDay)(now));
        const only = agencyId ? client_1.Prisma.sql `AND a.id = ${agencyId}::uuid` : client_1.Prisma.empty;
        return this.prisma.$executeRaw `
      INSERT INTO agency_daily_stats (agency_id, day, listing_views, updated_at)
      SELECT a.id, ${day}::date, COALESCE(SUM(l.view_count), 0)::int, now()
      FROM agencies a
      LEFT JOIN listing_agencies la
        ON la.agency_id = a.id AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status
      LEFT JOIN listings l ON l.id = la.listing_id AND l.deleted_at IS NULL
      WHERE a.status = ${shared_1.AgencyStatus.APPROVED}::agency_status AND a.deleted_at IS NULL ${only}
      GROUP BY a.id
      ON CONFLICT (agency_id, day)
      DO UPDATE SET listing_views = EXCLUDED.listing_views, updated_at = now()`;
    }
    async counts(agencyId, now) {
        const since = new Date(now.getTime() - 30 * DAY_MS);
        const [row] = await this.prisma.$queryRaw `
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
        AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status
        AND l.deleted_at IS NULL`;
        return row ?? { active: 0, reserved: 0, draft: 0, closed30d: 0, coBrokered: 0 };
    }
    /** Snapshots of the last 15 days (7 shown + 7 compared + 1 baseline). */
    async snapshots(agencyId, today) {
        const rows = await this.prisma.agencyDailyStat.findMany({
            where: { agencyId, day: { gte: (0, dashboard_1.dayToDate)((0, dashboard_1.addDays)(today, -14)), lte: (0, dashboard_1.dayToDate)(today) } },
            select: { day: true, listingViews: true },
        });
        return new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r.listingViews]));
    }
    favorites7d(agencyId, now) {
        return this.prisma.favoriteListing.count({
            where: {
                createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
                listing: {
                    deletedAt: null,
                    agencies: { some: { agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
                },
            },
        });
    }
    /** Live ads of the primary agency that lapse within a week, soonest first. */
    async expiring(agencyId, now) {
        const rows = await this.prisma.listing.findMany({
            where: {
                primaryAgencyId: agencyId,
                deletedAt: null,
                status: { in: LIVE_STATUSES },
                expiresAt: {
                    gte: now,
                    lte: new Date(now.getTime() + constants_1.DASHBOARD_EXPIRING_WITHIN_DAYS * DAY_MS),
                },
            },
            orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
            take: constants_1.DASHBOARD_LIST_LIMIT,
            select: dashboardListingSelect,
        });
        return rows.map((r) => (0, dashboard_1.toDashboardListing)(toRow(r), constants_1.LISTING_VERIFICATION_VALID_DAYS));
    }
    /**
     * Live listings of the primary agency never verified, or whose last 실매물 확인 runs out within
     * a week (or already did); never verified and oldest first.
     */
    async verificationDue(agencyId, now) {
        const staleBefore = new Date(now.getTime() - (constants_1.LISTING_VERIFICATION_VALID_DAYS - constants_1.DASHBOARD_VERIFICATION_SOON_DAYS) * DAY_MS);
        const rows = await this.prisma.listing.findMany({
            where: {
                primaryAgencyId: agencyId,
                deletedAt: null,
                status: { in: LIVE_STATUSES },
                OR: [{ verifiedAt: null }, { verifiedAt: { lte: staleBefore } }],
            },
            orderBy: [{ verifiedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
            take: constants_1.DASHBOARD_LIST_LIMIT,
            select: dashboardListingSelect,
        });
        return rows.map((r) => (0, dashboard_1.toDashboardListing)(toRow(r), constants_1.LISTING_VERIFICATION_VALID_DAYS));
    }
};
exports.AgencyDashboardService = AgencyDashboardService;
exports.AgencyDashboardService = AgencyDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AgencyDashboardService);
function toRow(r) {
    return {
        ...r,
        property: {
            floor: r.property.floor,
            totalFloors: r.property.totalFloors,
            exclusiveArea: (0, decimal_1.decimalToNumber)(r.property.exclusiveArea),
            supplyArea: (0, decimal_1.decimalToNumber)(r.property.supplyArea),
        },
    };
}
//# sourceMappingURL=agency-dashboard.service.js.map