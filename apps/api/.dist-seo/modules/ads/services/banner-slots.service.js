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
exports.BannerSlotsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const schedule_1 = require("../domain/schedule");
const slot_capacity_1 = require("../domain/slot-capacity");
const ads_references_port_1 = require("../ports/ads-references.port");
/** Slot limits: BANNER_SLOT_SPECS defaults, overridable per slot in banner_slot_configs. */
let BannerSlotsService = class BannerSlotsService {
    constructor(prisma, cache, refs) {
        this.prisma = prisma;
        this.cache = cache;
        this.refs = refs;
    }
    async settings(slot, db = this.prisma) {
        const row = await db.bannerSlotConfig.findUnique({ where: { slot } });
        return {
            maxActive: row?.maxActive ?? shared_1.BANNER_SLOT_SPECS[slot].maxActive,
            isEnabled: row?.isEnabled ?? true,
            note: row?.note ?? null,
        };
    }
    async list(now = new Date()) {
        const [configs, active, upcoming] = await Promise.all([
            this.prisma.bannerSlotConfig.findMany(),
            this.prisma.banner.groupBy({
                by: ['slot'],
                where: { deletedAt: null, ...(0, schedule_1.liveWhere)(now) },
                _count: { _all: true },
            }),
            this.prisma.banner.groupBy({
                by: ['slot'],
                where: { deletedAt: null, paused: false, endAt: { gt: now } },
                _count: { _all: true },
            }),
        ]);
        const bySlot = new Map(configs.map((c) => [c.slot, c]));
        const activeBySlot = new Map(active.map((r) => [r.slot, r._count._all]));
        const upcomingBySlot = new Map(upcoming.map((r) => [r.slot, r._count._all]));
        return (0, shared_1.enumValues)(shared_1.BannerSlot).map((slot) => {
            const c = bySlot.get(slot);
            return this.view(slot, {
                maxActive: c?.maxActive ?? shared_1.BANNER_SLOT_SPECS[slot].maxActive,
                isEnabled: c?.isEnabled ?? true,
                note: c?.note ?? null,
            }, activeBySlot.get(slot) ?? 0, upcomingBySlot.get(slot) ?? 0);
        });
    }
    async get(slot) {
        const all = await this.list();
        const found = all.find((s) => s.slot === slot);
        if (!found)
            throw app_exception_1.AppException.notFound();
        return found;
    }
    async update(slot, dto) {
        const before = await this.settings(slot);
        request_context_1.RequestContext.setAuditBefore({ slot, ...before });
        const next = {
            maxActive: dto.maxActive ?? before.maxActive,
            isEnabled: dto.isEnabled ?? before.isEnabled,
            note: dto.note === undefined ? before.note : dto.note || null,
        };
        await this.prisma.bannerSlotConfig.upsert({
            where: { slot },
            create: { slot, ...next },
            update: next,
        });
        await this.cache.bump(constants_1.ADS_CACHE.BANNERS);
        return this.get(slot);
    }
    /**
     * Serializes slot writes (create/schedule changes) so two concurrent requests cannot both pass
     * the capacity check. Transaction-scoped advisory lock.
     */
    async lock(tx, slot) {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`ads:banner-slot:${slot}`}))`;
    }
    /**
     * Throws 409 BANNER_SLOT_FULL when adding `banner` would exceed the slot's simultaneous limit
     * on some page at some instant from now on. The limit applies per page context, like serving:
     * COMPLEX_FEATURED_AGENCY holds `maxActive` agencies per complex page, MAP_AD per 읍면동, and
     * an ALL banner competes everywhere. Paused, ended and deleted banners do not count.
     */
    async assertCapacity(tx, slot, banner, opts = {}) {
        const now = opts.now ?? new Date();
        const from = banner.startAt > now ? banner.startAt : now;
        if (from >= banner.endAt)
            return;
        const { maxActive } = await this.settings(slot, tx);
        const rows = await tx.banner.findMany({
            where: {
                slot,
                deletedAt: null,
                paused: false,
                startAt: { lt: banner.endAt },
                endAt: { gt: from },
                ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
            },
            select: {
                startAt: true,
                endAt: true,
                targeting: true,
                targetRegions: { select: { regionCode: true } },
                targetComplexes: { select: { complexId: true } },
            },
        });
        const others = rows.map((r) => ({
            startAt: r.startAt,
            endAt: r.endAt,
            targeting: r.targeting,
            regionCodes: r.targetRegions.map((t) => t.regionCode),
            complexIds: r.targetComplexes.map((t) => t.complexId),
        }));
        const complexCodes = await this.refs.complexRegionCodesMany([...banner.complexIds, ...others.flatMap((o) => o.complexIds)], tx);
        const { peak, at, context } = (0, slot_capacity_1.worstContextConcurrency)({ startAt: from, endAt: banner.endAt }, banner, others, complexCodes);
        if (peak + 1 > maxActive) {
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.BANNER_SLOT_FULL, {
                slot,
                maxActive,
                concurrent: peak + 1,
                at: (at ?? from).toISOString(),
                context: contextDetails(context),
            });
        }
    }
    view(slot, s, activeCount, upcomingCount) {
        const spec = shared_1.BANNER_SLOT_SPECS[slot];
        return {
            slot,
            label: spec.label,
            pc: spec.pc,
            mobile: spec.mobile,
            maxActive: s.maxActive,
            defaultMaxActive: spec.maxActive,
            isEnabled: s.isEnabled,
            note: s.note,
            requiresAgency: spec.requiresAgency,
            requiredTargeting: spec.requiredTargeting,
            activeCount,
            upcomingCount,
        };
    }
};
exports.BannerSlotsService = BannerSlotsService;
exports.BannerSlotsService = BannerSlotsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(ads_references_port_1.ADS_REFERENCES)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService, Object])
], BannerSlotsService);
function contextDetails(ctx) {
    if (ctx?.kind === 'complex')
        return { complexId: ctx.complexId };
    if (ctx?.kind === 'region')
        return { regionCode: ctx.regionCode };
    return {};
}
//# sourceMappingURL=banner-slots.service.js.map