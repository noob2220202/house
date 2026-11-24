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
exports.NoticesService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const admin_mapper_1 = require("../admin.mapper");
const constants_1 = require("../constants");
const PUBLISHED = { isPublished: true, deletedAt: null };
const PUBLIC_ORDER = [
    { isPinned: 'desc' },
    { publishedAt: 'desc' },
    { id: 'desc' },
];
/** 공지사항: public list/detail (published only) and back-office CRUD (soft delete). */
let NoticesService = class NoticesService {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async publicList(q) {
        const v = await this.cache.version(constants_1.ADMIN_CACHE.CONTENT);
        return this.cache.getOrSet(`cache:admin:notices:v${v}:${q.page}:${q.pageSize}`, constants_1.CONTENT_CACHE_TTL_SECONDS, async () => {
            const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.notice.findMany({ where: PUBLISHED, orderBy: PUBLIC_ORDER, ...args }), () => this.prisma.notice.count({ where: PUBLISHED }));
            return { ...page, items: page.items.map(admin_mapper_1.toNoticeListItem) };
        });
    }
    /** Published notice; `countView` is false for bots so crawlers don't inflate the counter. */
    async publicDetail(id, countView) {
        const row = await this.prisma.notice.findFirst({ where: { id, ...PUBLISHED } });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.NOTICE_NOT_FOUND);
        if (!countView)
            return (0, admin_mapper_1.toNoticeView)(row);
        const updated = await this.prisma.notice.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });
        return (0, admin_mapper_1.toNoticeView)(updated);
    }
    async adminList(q) {
        const where = {
            deletedAt: null,
            ...(q.isPublished !== undefined ? { isPublished: q.isPublished } : {}),
            ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.notice.findMany({
            where,
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.notice.count({ where }));
        return { ...page, items: page.items.map(admin_mapper_1.toAdminNoticeView) };
    }
    async adminDetail(id) {
        return (0, admin_mapper_1.toAdminNoticeView)(await this.load(id));
    }
    async create(dto, admin) {
        const row = await this.prisma.notice.create({
            data: {
                ...dto,
                publishedAt: dto.isPublished ? new Date() : null,
                createdByAdminId: admin.adminId,
            },
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return (0, admin_mapper_1.toAdminNoticeView)(row);
    }
    async update(id, dto) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminNoticeView)(before));
        const row = await this.prisma.notice.update({
            where: { id },
            data: {
                ...dto,
                // First publication stamps publishedAt; re-publishing keeps the original date.
                ...(dto.isPublished && !before.publishedAt ? { publishedAt: new Date() } : {}),
            },
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return (0, admin_mapper_1.toAdminNoticeView)(row);
    }
    async remove(id) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminNoticeView)(before));
        await this.prisma.notice.update({ where: { id }, data: { deletedAt: new Date() } });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
    }
    async load(id) {
        const row = await this.prisma.notice.findFirst({ where: { id, deletedAt: null } });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.NOTICE_NOT_FOUND);
        return row;
    }
};
exports.NoticesService = NoticesService;
exports.NoticesService = NoticesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], NoticesService);
//# sourceMappingURL=notices.service.js.map