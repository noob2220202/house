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
var ListingExpiryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingExpiryService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const listing_notifier_port_1 = require("../ports/listing-notifier.port");
const listing_counters_service_1 = require("./listing-counters.service");
const PUBLIC_STATUSES = client_1.Prisma.join(shared_1.PUBLIC_LISTING_STATUSES.map((s) => client_1.Prisma.sql `${s}::listing_status`));
/**
 * 광고기간 만료: ACTIVE/RESERVED listings whose expiresAt has passed go back to DRAFT, so the
 * agency must re-check the property and publish again (which re-runs the 명시사항 check). Batched,
 * SKIP LOCKED and idempotent: a second run over the same state changes nothing.
 */
let ListingExpiryService = ListingExpiryService_1 = class ListingExpiryService {
    constructor(prisma, counters, notifier) {
        this.prisma = prisma;
        this.counters = counters;
        this.notifier = notifier;
        this.logger = new common_1.Logger(ListingExpiryService_1.name);
    }
    async expireDue(now = new Date(), batch = constants_1.EXPIRE_LISTING_ADS_BATCH) {
        let total = 0;
        for (;;) {
            const expired = await this.prisma.$transaction(async (tx) => {
                const rows = await tx.$queryRaw `
          UPDATE listings l
          SET status = ${shared_1.ListingStatus.DRAFT}::listing_status, version = l.version + 1,
              updated_at = now()
          WHERE l.id IN (
            SELECT id FROM listings
            WHERE status IN (${PUBLIC_STATUSES}) AND deleted_at IS NULL AND expires_at <= ${now}
            ORDER BY expires_at
            LIMIT ${batch}
            FOR UPDATE SKIP LOCKED)
          RETURNING l.id, l.complex_id AS "complexId", l.primary_agency_id AS "primaryAgencyId"`;
                if (rows.length === 0)
                    return rows;
                const ids = rows.map((r) => r.id);
                const links = await tx.listingAgency.findMany({
                    where: { listingId: { in: ids } },
                    select: { agencyId: true },
                });
                await this.counters.refresh(tx, {
                    complexIds: rows.map((r) => r.complexId),
                    agencyIds: links.map((l) => l.agencyId),
                });
                for (const r of rows) {
                    await this.notifier.notifyAgencyOwners(tx, [r.primaryAgencyId], {
                        type: shared_1.NotificationType.LISTING_EXPIRED,
                        title: '매물 광고기간이 만료되었습니다.',
                        body: '거래 가능 여부를 다시 확인한 뒤 매물을 다시 게시해 주세요.',
                        listingId: r.id,
                    });
                }
                return rows;
            });
            total += expired.length;
            if (expired.length < batch)
                break;
        }
        if (total > 0) {
            await this.counters.invalidateSearch();
            this.logger.log({ expired: total }, 'expired listing ads');
        }
        return total;
    }
};
exports.ListingExpiryService = ListingExpiryService;
exports.ListingExpiryService = ListingExpiryService = ListingExpiryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(listing_notifier_port_1.LISTING_NOTIFIER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        listing_counters_service_1.ListingCountersService, Object])
], ListingExpiryService);
//# sourceMappingURL=listing-expiry.service.js.map