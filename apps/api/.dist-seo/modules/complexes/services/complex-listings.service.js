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
exports.ComplexListingsService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_selects_1 = require("../../listings/listing.selects");
const DEAL_TYPES = (0, shared_1.enumValues)(shared_1.DealType);
/**
 * Same disclosure rule as public listing search/detail: 광고중/계약중, not deleted, and the
 * primary agency is disclosable (approved, not deleted). Listings of a SUSPENDED/REJECTED office
 * stay ACTIVE in the table but must not be counted on 단지 pages.
 */
const PUBLIC_LISTING_WHERE = {
    deletedAt: null,
    status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
    ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
};
function emptyCounts() {
    return {
        total: 0,
        byDealType: Object.fromEntries(DEAL_TYPES.map((d) => [d, 0])),
    };
}
/** Read-only aggregates over publicly visible listings for 단지 pages (listings module owns writes). */
let ComplexListingsService = class ComplexListingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Active (광고중/계약중) listing count, price range and 월세 range per deal type. */
    async summary(complexId) {
        const groups = await this.prisma.listing.groupBy({
            by: ['dealType'],
            where: { complexId, ...PUBLIC_LISTING_WHERE },
            _count: { _all: true },
            _min: { priceSort: true, monthlyRent: true },
            _max: { priceSort: true, monthlyRent: true },
        });
        const byType = new Map(groups.map((g) => [g.dealType, g]));
        const byDealType = DEAL_TYPES.map((dealType) => {
            const g = byType.get(dealType);
            const monthly = dealType === shared_1.DealType.MONTHLY;
            return {
                dealType,
                count: g?._count._all ?? 0,
                minPrice: g?._min.priceSort ?? null,
                maxPrice: g?._max.priceSort ?? null,
                minMonthlyRent: monthly ? (g?._min.monthlyRent ?? null) : null,
                maxMonthlyRent: monthly ? (g?._max.monthlyRent ?? null) : null,
            };
        });
        return {
            complexId,
            total: byDealType.reduce((n, d) => n + d.count, 0),
            byDealType,
        };
    }
    /** Per-deal-type active listing counts for many complexes in one query (no N+1). */
    async countsFor(complexIds) {
        const out = new Map(complexIds.map((id) => [id, emptyCounts()]));
        if (complexIds.length === 0)
            return out;
        const groups = await this.prisma.listing.groupBy({
            by: ['complexId', 'dealType'],
            where: { complexId: { in: [...complexIds] }, ...PUBLIC_LISTING_WHERE },
            _count: { _all: true },
        });
        for (const g of groups) {
            const c = g.complexId ? out.get(g.complexId) : undefined;
            if (!c)
                continue;
            c.byDealType[g.dealType] = g._count._all;
            c.total += g._count._all;
        }
        return out;
    }
};
exports.ComplexListingsService = ComplexListingsService;
exports.ComplexListingsService = ComplexListingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ComplexListingsService);
//# sourceMappingURL=complex-listings.service.js.map