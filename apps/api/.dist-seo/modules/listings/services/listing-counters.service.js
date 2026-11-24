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
exports.ListingCountersService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const constants_1 = require("../constants");
const PUBLIC_STATUSES = client_1.Prisma.join(shared_1.PUBLIC_LISTING_STATUSES.map((s) => client_1.Prisma.sql `${s}::listing_status`));
/** Same visibility rule as public search: the primary agency must be approved. */
const PRIMARY_APPROVED = client_1.Prisma.sql `EXISTS (SELECT 1 FROM agencies pa
  WHERE pa.id = l.primary_agency_id AND pa.status = ${shared_1.AgencyStatus.APPROVED}::agency_status
    AND pa.deleted_at IS NULL)`;
/**
 * Side effects of a change to publicly visible listing data: recompute the denormalized
 * active_listing_count of the affected complexes/agencies (SET from a COUNT, so idempotent) and
 * invalidate cached map tiles.
 *
 * Concurrency (READ COMMITTED): the counter rows are locked FOR UPDATE in a statement of their
 * own before recounting. A single `UPDATE … SET n = (SELECT count(*) …)` that waits on another
 * transaction's row lock re-checks only the target row after that commit; its subquery keeps the
 * statement's older snapshot and would write a count missing the other transaction's change.
 * Locking first means the recount statement starts after the lock is granted, with a fresh
 * snapshot. Lock order is fixed (complexes, then agencies, each by id) to avoid deadlocks between
 * refreshers.
 */
let ListingCountersService = class ListingCountersService {
    constructor(cache) {
        this.cache = cache;
    }
    async refresh(tx, scope) {
        const complexIds = [...new Set((scope.complexIds ?? []).filter((x) => !!x))];
        const agencyIds = [...new Set(scope.agencyIds ?? [])];
        complexIds.sort();
        agencyIds.sort();
        if (complexIds.length > 0) {
            await tx.$queryRaw `
        SELECT id FROM complexes WHERE id = ANY(${complexIds}::uuid[]) ORDER BY id FOR UPDATE`;
        }
        if (agencyIds.length > 0) {
            await tx.$queryRaw `
        SELECT id FROM agencies WHERE id = ANY(${agencyIds}::uuid[]) ORDER BY id FOR UPDATE`;
        }
        if (complexIds.length > 0) {
            await tx.$executeRaw `
        UPDATE complexes c SET active_listing_count = (
          SELECT count(*)::int FROM listings l
          WHERE l.complex_id = c.id AND l.deleted_at IS NULL AND l.status IN (${PUBLIC_STATUSES})
            AND ${PRIMARY_APPROVED}
        )
        WHERE c.id = ANY(${complexIds}::uuid[])`;
        }
        if (agencyIds.length > 0) {
            await tx.$executeRaw `
        UPDATE agencies a SET active_listing_count = (
          SELECT count(*)::int FROM listing_agencies la
          JOIN listings l ON l.id = la.listing_id
          WHERE la.agency_id = a.id
            AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status
            AND l.deleted_at IS NULL AND l.status IN (${PUBLIC_STATUSES})
            AND ${PRIMARY_APPROVED}
        )
        WHERE a.id = ANY(${agencyIds}::uuid[])`;
        }
    }
    /** Call after the transaction commits. */
    async invalidateSearch() {
        await this.cache.bump(constants_1.LISTINGS_SEARCH_CACHE_NS);
    }
};
exports.ListingCountersService = ListingCountersService;
exports.ListingCountersService = ListingCountersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], ListingCountersService);
//# sourceMappingURL=listing-counters.service.js.map