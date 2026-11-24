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
exports.VideosService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const admin_mapper_1 = require("../admin.mapper");
const constants_1 = require("../constants");
const ORDER = [
    { sortOrder: 'asc' },
    { publishedAt: 'desc' },
    { id: 'desc' },
];
/** YouTube URL → { youtubeVideoId, thumbnailUrl } (schema already checked the shape). */
function youtubeFields(url) {
    const id = (0, shared_1.parseYoutubeVideoId)(url);
    if (!id)
        throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.VIDEO_URL_INVALID);
    return { youtubeVideoId: id, thumbnailUrl: (0, shared_1.youtubeThumbnailUrl)(url) };
}
/** 지역 영상 (YouTube): public list (published only, cached) and back-office CRUD. */
let VideosService = class VideosService {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async publicList(q) {
        const where = {
            isPublished: true,
            deletedAt: null,
            ...(q.regionCode ? { regionCode: q.regionCode } : {}),
            ...(q.complexId ? { complexId: q.complexId } : {}),
        };
        const v = await this.cache.version(constants_1.ADMIN_CACHE.CONTENT);
        return this.cache.getOrSet(`cache:admin:videos:v${v}:${q.regionCode ?? '-'}:${q.complexId ?? '-'}:${q.page}:${q.pageSize}`, constants_1.CONTENT_CACHE_TTL_SECONDS, async () => {
            const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.localVideo.findMany({ where, orderBy: ORDER, ...args }), () => this.prisma.localVideo.count({ where }));
            return { ...page, items: page.items.map(admin_mapper_1.toLocalVideoView) };
        });
    }
    async adminList(q) {
        const where = {
            deletedAt: null,
            ...(q.regionCode ? { regionCode: q.regionCode } : {}),
            ...(q.complexId ? { complexId: q.complexId } : {}),
            ...(q.isPublished !== undefined ? { isPublished: q.isPublished } : {}),
            ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.localVideo.findMany({ where, orderBy: ORDER, ...args }), () => this.prisma.localVideo.count({ where }));
        return { ...page, items: page.items.map(admin_mapper_1.toAdminLocalVideoView) };
    }
    async adminDetail(id) {
        return (0, admin_mapper_1.toAdminLocalVideoView)(await this.load(id));
    }
    async create(dto) {
        if (dto.complexId)
            await this.assertComplex(dto.complexId);
        const row = await this.prisma.localVideo.create({
            data: {
                title: dto.title,
                youtubeUrl: dto.youtubeUrl,
                ...youtubeFields(dto.youtubeUrl),
                description: dto.description ?? null,
                regionCode: dto.regionCode ?? null,
                complexId: dto.complexId ?? null,
                sortOrder: dto.sortOrder,
                isPublished: dto.isPublished,
                publishedAt: dto.isPublished ? new Date() : null,
            },
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return (0, admin_mapper_1.toAdminLocalVideoView)(row);
    }
    async update(id, dto) {
        const before = await this.load(id);
        if (dto.complexId)
            await this.assertComplex(dto.complexId);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminLocalVideoView)(before));
        const row = await this.prisma.localVideo.update({
            where: { id },
            data: {
                ...dto,
                ...(dto.youtubeUrl !== undefined ? youtubeFields(dto.youtubeUrl) : {}),
                ...(dto.isPublished && !before.publishedAt ? { publishedAt: new Date() } : {}),
            },
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return (0, admin_mapper_1.toAdminLocalVideoView)(row);
    }
    async remove(id) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminLocalVideoView)(before));
        await this.prisma.localVideo.update({ where: { id }, data: { deletedAt: new Date() } });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
    }
    /**
     * PUT /admin/videos/order: `ids` in display order get sortOrder 1…n (as the admin app expects);
     * videos not listed keep theirs. Every id must be a live (not deleted) video.
     */
    async reorder(ids) {
        await this.prisma.$transaction(async (tx) => {
            const found = await tx.localVideo.findMany({
                where: { id: { in: ids }, deletedAt: null },
                select: { id: true, sortOrder: true },
            });
            if (found.length !== ids.length) {
                const known = new Set(found.map((v) => v.id));
                throw new app_exception_1.AppException(shared_1.ErrorCode.VALIDATION_FAILED, {
                    message: '목록에 없는 영상이 포함되어 있습니다. 새로고침 후 다시 시도해 주세요.',
                    details: { unknownIds: ids.filter((id) => !known.has(id)) },
                });
            }
            request_context_1.RequestContext.setAuditBefore(found);
            await tx.$executeRaw `
        UPDATE local_videos AS v SET sort_order = o.ord::int, updated_at = now()
        FROM unnest(${ids}::uuid[]) WITH ORDINALITY AS o(id, ord)
        WHERE v.id = o.id`;
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
    }
    async assertComplex(complexId) {
        const found = await this.prisma.complex.findFirst({
            where: { id: complexId, deletedAt: null },
            select: { id: true },
        });
        if (!found)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.VIDEO_COMPLEX_NOT_FOUND);
    }
    async load(id) {
        const row = await this.prisma.localVideo.findFirst({ where: { id, deletedAt: null } });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.VIDEO_NOT_FOUND);
        return row;
    }
};
exports.VideosService = VideosService;
exports.VideosService = VideosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], VideosService);
//# sourceMappingURL=videos.service.js.map