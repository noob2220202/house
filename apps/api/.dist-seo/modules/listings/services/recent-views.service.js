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
var RecentViewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentViewsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const listing_selects_1 = require("../listing.selects");
const listing_summaries_service_1 = require("./listing-summaries.service");
/** 최근 본 매물/단지/중개사무소. Exported so the complexes/agencies modules can record views. */
let RecentViewsService = RecentViewsService_1 = class RecentViewsService {
    constructor(prisma, summaries) {
        this.prisma = prisma;
        this.summaries = summaries;
        this.logger = new common_1.Logger(RecentViewsService_1.name);
    }
    /** Upserts the view and trims the user's history of that type to RECENT_VIEWS_CAP. Never throws. */
    async record(userId, targetType, targetId) {
        try {
            const viewedAt = new Date();
            await this.prisma.recentView.upsert({
                where: { userId_targetType_targetId: { userId, targetType, targetId } },
                create: { userId, targetType, targetId, viewedAt },
                update: { viewedAt },
            });
            await this.prisma.$executeRaw `
        DELETE FROM recent_views rv
        USING (
          SELECT target_id FROM recent_views
          WHERE user_id = ${userId}::uuid AND target_type = ${targetType}::recent_view_target
          ORDER BY viewed_at DESC
          OFFSET ${constants_1.RECENT_VIEWS_CAP}
        ) old
        WHERE rv.user_id = ${userId}::uuid
          AND rv.target_type = ${targetType}::recent_view_target
          AND rv.target_id = old.target_id`;
        }
        catch (err) {
            this.logger.warn({ err, targetType, targetId }, 'recent view record failed');
        }
    }
    async list(userId, q) {
        const where = { userId, targetType: q.targetType };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.recentView.findMany({
            where,
            orderBy: { viewedAt: 'desc' },
            select: { targetType: true, targetId: true, viewedAt: true },
            ...args,
        }), () => this.prisma.recentView.count({ where }));
        const ids = page.items.map((r) => r.targetId);
        const base = page.items.map((r) => ({
            targetType: r.targetType,
            targetId: r.targetId,
            viewedAt: r.viewedAt.toISOString(),
        }));
        if (ids.length === 0)
            return { ...page, items: base };
        switch (q.targetType) {
            case shared_1.RecentViewTarget.LISTING: {
                const rows = await this.prisma.listing.findMany({
                    where: {
                        id: { in: ids },
                        deletedAt: null,
                        status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                        ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
                    },
                    select: listing_selects_1.LISTING_SUMMARY_SELECT,
                });
                const summaries = await this.summaries.map(rows);
                const byId = new Map(summaries.map((r) => [r.id, r]));
                return { ...page, items: base.map((b) => ({ ...b, listing: byId.get(b.targetId) })) };
            }
            case shared_1.RecentViewTarget.COMPLEX: {
                const rows = await this.prisma.complex.findMany({
                    where: { id: { in: ids }, deletedAt: null },
                    select: { id: true, name: true, roadAddress: true },
                });
                const byId = new Map(rows.map((r) => [r.id, r]));
                return { ...page, items: base.map((b) => ({ ...b, complex: byId.get(b.targetId) })) };
            }
            case shared_1.RecentViewTarget.AGENCY: {
                const rows = await this.prisma.agency.findMany({
                    where: { id: { in: ids }, deletedAt: null },
                    select: { id: true, name: true, roadAddress: true },
                });
                const byId = new Map(rows.map((r) => [r.id, r]));
                return { ...page, items: base.map((b) => ({ ...b, agency: byId.get(b.targetId) })) };
            }
        }
    }
    async clear(userId, targetType) {
        const { count } = await this.prisma.recentView.deleteMany({
            where: { userId, ...(targetType ? { targetType } : {}) },
        });
        return count;
    }
};
exports.RecentViewsService = RecentViewsService;
exports.RecentViewsService = RecentViewsService = RecentViewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        listing_summaries_service_1.ListingSummariesService])
], RecentViewsService);
//# sourceMappingURL=recent-views.service.js.map