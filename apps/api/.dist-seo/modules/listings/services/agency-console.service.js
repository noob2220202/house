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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyConsoleService = exports.CONSOLE_REMINDER_DAYS = void 0;
exports.verificationDueBefore = verificationDueBefore;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const pagination_1 = require("../../../common/pagination/pagination");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const dates_1 = require("../domain/dates");
const listing_selects_1 = require("../listing.selects");
const agency_membership_port_1 = require("../ports/agency-membership.port");
const listing_media_port_1 = require("../ports/listing-media.port");
/** Reminder window of the console chips (frontend VERIFICATION_SOON_DAYS). */
exports.CONSOLE_REMINDER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A 실매물 확인 keeps an ad up for LISTING_AD_TTL_DAYS; it is "due" when that ends within
 * CONSOLE_REMINDER_DAYS (counted in KST days, like the console's D-day badge): verified before
 * the returned instant.
 */
function verificationDueBefore(now) {
    return new Date((0, dates_1.kstDayStart)((0, dates_1.kstToday)(now)).getTime() -
        (constants_1.LISTING_AD_TTL_DAYS - exports.CONSOLE_REMINDER_DAYS - 1) * DAY_MS);
}
const CANDIDATE_SELECT = {
    id: true,
    listingNo: true,
    status: true,
    dealType: true,
    assetType: true,
    title: true,
    salePrice: true,
    deposit: true,
    monthlyRent: true,
    presalePrice: true,
    premium: true,
    exclusiveArea: true,
    floorClass: true,
    floorDisplay: true,
    direction: true,
    verifiedAt: true,
    publishedAt: true,
    property: {
        select: {
            roadAddress: true,
            buildingName: true,
            dong: true,
            floor: true,
            totalFloors: true,
            supplyArea: true,
        },
    },
    complex: { select: { name: true } },
    primaryAgency: { select: { name: true } },
    photos: {
        where: { isCover: true },
        take: 1,
        select: { media: { select: { storageKey: true, variants: true } } },
    },
};
const iso = (d) => (d ? d.toISOString() : null);
const stripSido = (address) => address.replace(/^(전남광주통합특별시|전라남도|전남)\s*/, '');
/** "101동" / "101" → "101" (dong filter compares without the suffix). */
const dongStem = (s) => s.replace(/\s+/g, '').replace(/동$/, '');
/** Broker console reads that are not one listing: status counters and co-brokerage candidates. */
let AgencyConsoleService = class AgencyConsoleService {
    constructor(prisma, membership, media) {
        this.prisma = prisma;
        this.membership = membership;
        this.media = media;
    }
    async summary(principal, now = new Date()) {
        const actor = await this.membership.resolveActor(principal);
        const mine = {
            deletedAt: null,
            agencies: { some: { agencyId: actor.agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
        };
        const [groups, verificationDue, expiringSoon, coBrokered] = await Promise.all([
            this.prisma.listing.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
            this.prisma.listing.count({
                where: {
                    ...mine,
                    status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                    OR: [{ verifiedAt: null }, { verifiedAt: { lt: verificationDueBefore(now) } }],
                },
            }),
            this.prisma.listing.count({
                where: {
                    ...mine,
                    status: shared_1.ListingStatus.ACTIVE,
                    expiresAt: { gt: now, lte: new Date(now.getTime() + exports.CONSOLE_REMINDER_DAYS * DAY_MS) },
                },
            }),
            this.prisma.listing.count({ where: { ...mine, primaryAgencyId: { not: actor.agencyId } } }),
        ]);
        const byStatus = {
            DRAFT: 0,
            ACTIVE: 0,
            RESERVED: 0,
            CLOSED: 0,
            HIDDEN: 0,
        };
        for (const g of groups)
            byStatus[g.status] = g._count._all;
        return {
            total: Object.values(byStatus).reduce((n, c) => n + c, 0),
            byStatus,
            verificationDue,
            expiringSoon,
            coBrokered,
        };
    }
    /**
     * Public listings of OTHER offices in a 단지 that the caller's agency may ask to co-broker
     * (공동중개 신청). Public fields only: never 호, and no exact floor when the primary office
     * advertises 저/중/고.
     */
    async coBrokerCandidates(principal, q) {
        const actor = await this.membership.resolveActor(principal);
        const and = [
            {
                complexId: q.complexId,
                deletedAt: null,
                status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                primaryAgencyId: { not: actor.agencyId },
                ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
            },
        ];
        if (q.dong) {
            const stem = dongStem(q.dong);
            and.push({ property: { dong: { in: [stem, `${stem}동`] } } });
        }
        if (q.q) {
            const listingNo = (0, shared_1.parseListingNo)(q.q);
            and.push({
                OR: [
                    { property: { dong: { contains: q.q, mode: 'insensitive' } } },
                    { title: { contains: q.q, mode: 'insensitive' } },
                    ...(listingNo === null ? [] : [{ listingNo }]),
                ],
            });
        }
        const where = { AND: and };
        return (0, pagination_1.paginate)(q, async (args) => {
            const rows = await this.prisma.listing.findMany({
                where,
                orderBy: [
                    { verifiedAt: { sort: 'desc', nulls: 'last' } },
                    { publishedAt: { sort: 'desc', nulls: 'last' } },
                    { id: 'desc' },
                ],
                select: CANDIDATE_SELECT,
                ...args,
            });
            const ids = rows.map((r) => r.id);
            const links = ids.length === 0
                ? []
                : await this.prisma.listingAgency.findMany({
                    where: {
                        listingId: { in: ids },
                        status: shared_1.ListingAgencyStatus.ACTIVE,
                        agency: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
                    },
                    select: { listingId: true, agencyId: true },
                });
            const counts = new Map();
            const joined = new Set();
            for (const l of links) {
                counts.set(l.listingId, (counts.get(l.listingId) ?? 0) + 1);
                if (l.agencyId === actor.agencyId)
                    joined.add(l.listingId);
            }
            return rows.map((r) => this.candidate(r, counts.get(r.id) ?? 1, joined.has(r.id)));
        }, () => this.prisma.listing.count({ where }));
    }
    candidate(r, agencyCount, joined) {
        const prices = (0, shared_1.applicablePrices)(r.dealType, r);
        const cover = r.photos[0];
        return {
            id: r.id,
            listingNo: (0, shared_1.formatListingNo)(r.listingNo),
            status: r.status,
            dealType: r.dealType,
            assetType: r.assetType,
            name: r.complex?.name ?? r.property.buildingName ?? stripSido(r.property.roadAddress),
            dong: r.property.dong,
            salePrice: prices.salePrice ?? null,
            deposit: prices.deposit ?? null,
            monthlyRent: prices.monthlyRent ?? null,
            presalePrice: prices.presalePrice ?? null,
            premium: prices.premium ?? null,
            exclusiveArea: (0, decimal_1.decimalToNumber)(r.exclusiveArea),
            supplyArea: (0, decimal_1.decimalToNumber)(r.property.supplyArea),
            floor: r.floorDisplay === shared_1.FloorDisplay.CLASS ? null : r.property.floor,
            totalFloors: r.property.totalFloors,
            floorClass: r.floorClass,
            direction: r.direction,
            coverPhotoUrl: cover ? this.media.urls(cover.media).thumbUrl : null,
            verifiedAt: iso(r.verifiedAt),
            publishedAt: iso(r.publishedAt),
            agencyCount,
            primaryAgencyName: r.primaryAgency.name,
            joined,
        };
    }
};
exports.AgencyConsoleService = AgencyConsoleService;
exports.AgencyConsoleService = AgencyConsoleService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(agency_membership_port_1.LISTING_AGENCY_MEMBERSHIP)),
    __param(2, (0, common_1.Inject)(listing_media_port_1.LISTING_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, Object])
], AgencyConsoleService);
//# sourceMappingURL=agency-console.service.js.map