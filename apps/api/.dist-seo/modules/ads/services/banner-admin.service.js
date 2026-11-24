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
exports.BannerAdminService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const audit_service_1 = require("../../../common/audit/audit.service");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const zod_validation_pipe_1 = require("../../../common/pipes/zod-validation.pipe");
const prisma_service_1 = require("../../../prisma/prisma.service");
const ads_mapper_1 = require("../ads.mapper");
const constants_1 = require("../constants");
const schedule_1 = require("../domain/schedule");
const slot_capacity_1 = require("../domain/slot-capacity");
const ads_media_port_1 = require("../ports/ads-media.port");
const ads_references_port_1 = require("../ports/ads-references.port");
const banner_slots_service_1 = require("./banner-slots.service");
const blankToNull = (v) => v === undefined ? undefined : v === null || v.trim() === '' ? null : v;
/** Admin CRUD, reorder and validation of banners. Every write bumps the public serve cache. */
let BannerAdminService = class BannerAdminService {
    constructor(prisma, slots, mapper, cache, audit, media, refs) {
        this.prisma = prisma;
        this.slots = slots;
        this.mapper = mapper;
        this.cache = cache;
        this.audit = audit;
        this.media = media;
        this.refs = refs;
    }
    async list(q, now = new Date()) {
        const where = {
            deletedAt: null,
            ...(q.slot ? { slot: q.slot } : {}),
            ...(q.agencyId ? { agencyId: q.agencyId } : {}),
            ...(q.status ? (0, schedule_1.scheduleStatusWhere)(q.status, now) : {}),
            ...(q.q
                ? {
                    OR: [
                        { title: { contains: q.q, mode: 'insensitive' } },
                        { advertiserName: { contains: q.q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const orderBy = q.slot
            ? [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]
            : [{ createdAt: 'desc' }, { id: 'desc' }];
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.banner.findMany({ where, orderBy, select: ads_mapper_1.adminBannerSelect, ...args }), () => this.prisma.banner.count({ where }));
        return { ...page, items: page.items.map((b) => this.mapper.adminBanner(b, now)) };
    }
    async get(id) {
        return this.mapper.adminBanner(await this.load(id));
    }
    async create(dto, adminId) {
        const now = new Date();
        const startAt = new Date(dto.startAt);
        const endAt = new Date(dto.endAt);
        const row = await this.prisma.$transaction(async (tx) => {
            await this.slots.lock(tx, dto.slot);
            await this.assertReferences(tx, {
                mediaIds: [dto.pcMediaId, dto.mobileMediaId],
                agencyId: dto.agencyId,
                regionCodes: dto.targetRegionCodes,
                complexIds: dto.targetComplexIds,
            });
            if (!dto.paused) {
                await this.slots.assertCapacity(tx, dto.slot, {
                    startAt,
                    endAt,
                    targeting: dto.targeting,
                    regionCodes: dto.targetRegionCodes,
                    complexIds: dto.targetComplexIds,
                }, { now });
            }
            const last = await tx.banner.aggregate({
                where: { slot: dto.slot, deletedAt: null },
                _max: { sortOrder: true },
            });
            return tx.banner.create({
                data: {
                    slot: dto.slot,
                    title: dto.title,
                    advertiserName: blankToNull(dto.advertiserName) ?? null,
                    agencyId: dto.agencyId ?? null,
                    pcMediaId: dto.pcMediaId,
                    mobileMediaId: dto.mobileMediaId ?? null,
                    linkUrl: dto.linkUrl ?? null,
                    newWindow: dto.newWindow,
                    startAt,
                    endAt,
                    paused: dto.paused,
                    priority: dto.priority,
                    sortOrder: (last._max.sortOrder ?? -1) + 1,
                    targeting: dto.targeting,
                    memo: blankToNull(dto.memo) ?? null,
                    createdByAdminId: adminId,
                    targetRegions: {
                        createMany: { data: dto.targetRegionCodes.map((regionCode) => ({ regionCode })) },
                    },
                    targetComplexes: {
                        createMany: { data: dto.targetComplexIds.map((complexId) => ({ complexId })) },
                    },
                },
                select: ads_mapper_1.adminBannerSelect,
            });
        });
        await this.cache.bump(constants_1.ADS_CACHE.BANNERS);
        return this.mapper.adminBanner(row, now);
    }
    async update(id, dto) {
        const now = new Date();
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore(this.mapper.adminBanner(current, now));
        const oldRegions = current.targetRegions.map((r) => r.regionCode);
        const oldComplexes = current.targetComplexes.map((t) => t.complex.id);
        const targeting = dto.targeting ?? current.targeting;
        const regions = dto.targetRegionCodes ?? (targeting === shared_1.BannerTargeting.REGIONS ? oldRegions : []);
        const complexes = dto.targetComplexIds ?? (targeting === shared_1.BannerTargeting.COMPLEXES ? oldComplexes : []);
        const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
        const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
        const paused = dto.paused ?? current.paused;
        const agencyId = dto.agencyId === undefined ? (current.agency?.id ?? null) : dto.agencyId;
        // Cross-field rules on the merged row (PATCH bodies are partial).
        (0, zod_validation_pipe_1.parseOrThrow)(zod_1.z.unknown().superRefine((_, ctx) => {
            (0, shared_1.checkAdWindow)({ startAt: startAt.toISOString(), endAt: endAt.toISOString() }, ctx);
            (0, shared_1.checkBannerTargeting)({ targeting, targetRegionCodes: regions, targetComplexIds: complexes }, ctx);
            (0, shared_1.checkBannerSlotRules)({ slot: current.slot, agencyId, targeting }, ctx);
        }), null);
        const regionsChanged = !sameSet(regions, oldRegions);
        const complexesChanged = !sameSet(complexes, oldComplexes);
        const newPc = dto.pcMediaId && dto.pcMediaId !== current.pcMedia.id ? dto.pcMediaId : undefined;
        const oldMobile = current.mobileMedia?.id ?? null;
        const newMobile = dto.mobileMediaId && dto.mobileMediaId !== oldMobile ? dto.mobileMediaId : undefined;
        const releasedMedia = [
            ...(newPc ? [current.pcMedia.id] : []),
            ...(oldMobile && dto.mobileMediaId !== undefined && dto.mobileMediaId !== oldMobile
                ? [oldMobile]
                : []),
        ];
        // Re-check capacity only when the banner becomes live somewhere/somewhen it was not:
        // copy edits, shortening, pausing or narrowing must keep working after a slot limit was
        // lowered (that is exactly when admins cut banners back).
        const grows = !paused &&
            ((0, slot_capacity_1.windowGrows)({ startAt: current.startAt, endAt: current.endAt, paused: current.paused }, {
                startAt,
                endAt,
                paused,
            }) ||
                (0, slot_capacity_1.placementGrows)({
                    targeting: current.targeting,
                    regionCodes: oldRegions,
                    complexIds: oldComplexes,
                }, { targeting, regionCodes: regions, complexIds: complexes }));
        const row = await this.prisma.$transaction(async (tx) => {
            if (grows)
                await this.slots.lock(tx, current.slot);
            await this.assertReferences(tx, {
                mediaIds: [newPc, newMobile],
                agencyId: dto.agencyId && dto.agencyId !== current.agency?.id ? dto.agencyId : undefined,
                regionCodes: regionsChanged ? regions.filter((c) => !oldRegions.includes(c)) : [],
                complexIds: complexesChanged ? complexes.filter((c) => !oldComplexes.includes(c)) : [],
            });
            if (grows) {
                await this.slots.assertCapacity(tx, current.slot, { startAt, endAt, targeting, regionCodes: regions, complexIds: complexes }, { excludeId: id, now });
            }
            if (regionsChanged) {
                await tx.bannerTargetRegion.deleteMany({ where: { bannerId: id } });
                await tx.bannerTargetRegion.createMany({
                    data: regions.map((regionCode) => ({ bannerId: id, regionCode })),
                });
            }
            if (complexesChanged) {
                await tx.bannerTargetComplex.deleteMany({ where: { bannerId: id } });
                await tx.bannerTargetComplex.createMany({
                    data: complexes.map((complexId) => ({ bannerId: id, complexId })),
                });
            }
            const updated = await tx.banner.update({
                where: { id },
                data: {
                    title: dto.title,
                    advertiserName: blankToNull(dto.advertiserName),
                    agencyId: dto.agencyId,
                    pcMediaId: dto.pcMediaId,
                    mobileMediaId: dto.mobileMediaId,
                    linkUrl: dto.linkUrl,
                    newWindow: dto.newWindow,
                    startAt,
                    endAt,
                    paused,
                    priority: dto.priority,
                    targeting,
                    memo: blankToNull(dto.memo),
                },
                select: ads_mapper_1.adminBannerSelect,
            });
            await this.media.released(releasedMedia, tx);
            return updated;
        });
        await this.cache.bump(constants_1.ADS_CACHE.BANNERS);
        return this.mapper.adminBanner(row, now);
    }
    /**
     * Soft delete; stats rows stay for reporting. The row keeps its media FKs, so the images stay
     * "attached" for the media library; released() only restarts their grace period.
     */
    async remove(id) {
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore(this.mapper.adminBanner(current));
        await this.prisma.$transaction(async (tx) => {
            await tx.banner.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.media.released([current.pcMedia.id, ...(current.mobileMedia ? [current.mobileMedia.id] : [])], tx);
        });
        await this.cache.bump(constants_1.ADS_CACHE.BANNERS);
    }
    /**
     * Sets the display order of a slot: `ids` (any subset of the slot's banners) come first in the
     * given order, the slot's other not-ended banners keep their relative order after them.
     */
    async reorder(dto) {
        const now = new Date();
        const rows = await this.prisma.$transaction(async (tx) => {
            await this.slots.lock(tx, dto.slot);
            const inSlot = await tx.banner.findMany({
                where: {
                    slot: dto.slot,
                    deletedAt: null,
                    OR: [{ id: { in: dto.ids } }, { endAt: { gt: now } }],
                },
                select: { id: true, sortOrder: true },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
            });
            const known = new Set(inSlot.map((b) => b.id));
            const unknown = dto.ids.filter((id) => !known.has(id));
            if (unknown.length > 0) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.BANNER_REORDER_INVALID, { unknownIds: unknown });
            }
            const listed = new Set(dto.ids);
            const order = [...dto.ids, ...inSlot.filter((b) => !listed.has(b.id)).map((b) => b.id)];
            await this.applyOrder(tx, order);
            await this.audit.record({
                action: 'banner.reorder',
                resourceType: 'Banner',
                resourceId: dto.slot,
                before: { slot: dto.slot, ids: inSlot.map((b) => b.id) },
                after: { slot: dto.slot, ids: order },
            }, tx);
            return tx.banner.findMany({
                where: { id: { in: order } },
                select: ads_mapper_1.adminBannerSelect,
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            });
        });
        await this.cache.bump(constants_1.ADS_CACHE.BANNERS);
        return { items: rows.map((b) => this.mapper.adminBanner(b, now)) };
    }
    /** Existing, not-deleted banner or 404. */
    async load(id) {
        const row = await this.prisma.banner.findFirst({
            where: { id, deletedAt: null },
            select: ads_mapper_1.adminBannerSelect,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.BANNER_NOT_FOUND);
        return row;
    }
    async applyOrder(tx, ids) {
        if (ids.length === 0)
            return;
        const values = client_1.Prisma.join(ids.map((id, i) => client_1.Prisma.sql `(${id}::uuid, ${i}::int)`));
        await tx.$executeRaw `
      UPDATE banners AS b SET sort_order = v.ord, updated_at = now()
      FROM (VALUES ${values}) AS v(id, ord)
      WHERE b.id = v.id AND b.sort_order IS DISTINCT FROM v.ord`;
    }
    /** Inside the write transaction: media rows stay locked (FOR SHARE) until commit. */
    async assertReferences(tx, refs) {
        const mediaIds = refs.mediaIds.filter((m) => typeof m === 'string');
        // Sequential: one transaction connection.
        await this.media.assertUsable(mediaIds, shared_1.MediaPurpose.BANNER, tx);
        if (refs.agencyId)
            await this.refs.assertAgency(refs.agencyId, tx);
        await this.refs.assertRegions(refs.regionCodes, tx);
        await this.refs.assertComplexes(refs.complexIds, tx);
    }
};
exports.BannerAdminService = BannerAdminService;
exports.BannerAdminService = BannerAdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(ads_media_port_1.ADS_MEDIA)),
    __param(6, (0, common_1.Inject)(ads_references_port_1.ADS_REFERENCES)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        banner_slots_service_1.BannerSlotsService,
        ads_mapper_1.AdsMapper,
        cache_service_1.CacheService,
        audit_service_1.AuditService, Object, Object])
], BannerAdminService);
function sameSet(a, b) {
    if (a.length !== b.length)
        return false;
    const s = new Set(a);
    return b.every((x) => s.has(x));
}
//# sourceMappingURL=banner-admin.service.js.map