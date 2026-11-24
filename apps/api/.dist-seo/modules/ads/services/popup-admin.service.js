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
exports.PopupAdminService = void 0;
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
const ads_media_port_1 = require("../ports/ads-media.port");
const POPUP_ORDER_LOCK = 'ads:popup-order';
/** Admin CRUD + reorder of popups. Every write bumps the public popup cache. */
let PopupAdminService = class PopupAdminService {
    constructor(prisma, mapper, cache, audit, media) {
        this.prisma = prisma;
        this.mapper = mapper;
        this.cache = cache;
        this.audit = audit;
        this.media = media;
    }
    async list(q, now = new Date()) {
        const where = {
            deletedAt: null,
            ...(q.status ? (0, schedule_1.scheduleStatusWhere)(q.status, now) : {}),
            ...(q.targetPage ? { targetPages: { has: q.targetPage } } : {}),
            ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.popup.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
            select: ads_mapper_1.adminPopupSelect,
            ...args,
        }), () => this.prisma.popup.count({ where }));
        return { ...page, items: page.items.map((p) => this.mapper.adminPopup(p, now)) };
    }
    async get(id) {
        return this.mapper.adminPopup(await this.load(id));
    }
    async create(dto, adminId) {
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${POPUP_ORDER_LOCK}))`;
            await this.media.assertUsable([dto.mediaId], shared_1.MediaPurpose.POPUP, tx);
            const last = await tx.popup.aggregate({
                where: { deletedAt: null },
                _max: { sortOrder: true },
            });
            return tx.popup.create({
                data: {
                    title: dto.title,
                    mediaId: dto.mediaId,
                    linkUrl: dto.linkUrl ?? null,
                    newWindow: dto.newWindow,
                    targetPages: dto.targetPages,
                    startAt: new Date(dto.startAt),
                    endAt: new Date(dto.endAt),
                    paused: dto.paused,
                    dismissDays: dto.dismissDays,
                    sortOrder: (last._max.sortOrder ?? -1) + 1,
                    createdByAdminId: adminId,
                },
                select: ads_mapper_1.adminPopupSelect,
            });
        });
        await this.cache.bump(constants_1.ADS_CACHE.POPUPS);
        return this.mapper.adminPopup(row);
    }
    async update(id, dto) {
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore(this.mapper.adminPopup(current));
        const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
        const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
        (0, zod_validation_pipe_1.parseOrThrow)(zod_1.z
            .unknown()
            .superRefine((_, ctx) => (0, shared_1.checkAdWindow)({ startAt: startAt.toISOString(), endAt: endAt.toISOString() }, ctx)), null);
        const newMedia = dto.mediaId && dto.mediaId !== current.media.id ? dto.mediaId : undefined;
        const row = await this.prisma.$transaction(async (tx) => {
            if (newMedia)
                await this.media.assertUsable([newMedia], shared_1.MediaPurpose.POPUP, tx);
            const updated = await tx.popup.update({
                where: { id },
                data: {
                    title: dto.title,
                    mediaId: dto.mediaId,
                    linkUrl: dto.linkUrl,
                    newWindow: dto.newWindow,
                    targetPages: dto.targetPages,
                    startAt,
                    endAt,
                    paused: dto.paused,
                    dismissDays: dto.dismissDays,
                },
                select: ads_mapper_1.adminPopupSelect,
            });
            if (newMedia)
                await this.media.released([current.media.id], tx);
            return updated;
        });
        await this.cache.bump(constants_1.ADS_CACHE.POPUPS);
        return this.mapper.adminPopup(row);
    }
    async remove(id) {
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore(this.mapper.adminPopup(current));
        await this.prisma.$transaction(async (tx) => {
            await tx.popup.update({ where: { id }, data: { deletedAt: new Date() } });
            await this.media.released([current.media.id], tx);
        });
        await this.cache.bump(constants_1.ADS_CACHE.POPUPS);
    }
    /** `ids` first in the given order; other not-ended popups keep their relative order after them. */
    async reorder(dto) {
        const now = new Date();
        const rows = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${POPUP_ORDER_LOCK}))`;
            const existing = await tx.popup.findMany({
                where: { deletedAt: null, OR: [{ id: { in: dto.ids } }, { endAt: { gt: now } }] },
                select: { id: true },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
            });
            const known = new Set(existing.map((p) => p.id));
            const unknown = dto.ids.filter((id) => !known.has(id));
            if (unknown.length > 0) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.POPUP_REORDER_INVALID, { unknownIds: unknown });
            }
            const listed = new Set(dto.ids);
            const order = [...dto.ids, ...existing.filter((p) => !listed.has(p.id)).map((p) => p.id)];
            const values = client_1.Prisma.join(order.map((pid, i) => client_1.Prisma.sql `(${pid}::uuid, ${i}::int)`));
            await tx.$executeRaw `
        UPDATE popups AS p SET sort_order = v.ord, updated_at = now()
        FROM (VALUES ${values}) AS v(id, ord)
        WHERE p.id = v.id AND p.sort_order IS DISTINCT FROM v.ord`;
            await this.audit.record({
                action: 'popup.reorder',
                resourceType: 'Popup',
                before: { ids: existing.map((p) => p.id) },
                after: { ids: order },
            }, tx);
            return tx.popup.findMany({
                where: { id: { in: order } },
                select: ads_mapper_1.adminPopupSelect,
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            });
        });
        await this.cache.bump(constants_1.ADS_CACHE.POPUPS);
        return { items: rows.map((p) => this.mapper.adminPopup(p, now)) };
    }
    async load(id) {
        const row = await this.prisma.popup.findFirst({
            where: { id, deletedAt: null },
            select: ads_mapper_1.adminPopupSelect,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.POPUP_NOT_FOUND);
        return row;
    }
};
exports.PopupAdminService = PopupAdminService;
exports.PopupAdminService = PopupAdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(ads_media_port_1.ADS_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ads_mapper_1.AdsMapper,
        cache_service_1.CacheService,
        audit_service_1.AuditService, Object])
], PopupAdminService);
//# sourceMappingURL=popup-admin.service.js.map