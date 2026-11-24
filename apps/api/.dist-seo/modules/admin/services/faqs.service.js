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
exports.FaqsService = void 0;
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
    { category: 'asc' },
    { sortOrder: 'asc' },
    { id: 'asc' },
];
function searchWhere(q) {
    if (!q)
        return {};
    return {
        OR: [
            { question: { contains: q, mode: 'insensitive' } },
            { answer: { contains: q, mode: 'insensitive' } },
        ],
    };
}
/** FAQ: public list (published only, cached) and back-office CRUD + ordering. */
let FaqsService = class FaqsService {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async publicList(q) {
        const where = {
            isPublished: true,
            deletedAt: null,
            ...(q.category ? { category: q.category } : {}),
            ...searchWhere(q.q),
        };
        const compute = async () => {
            const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.faq.findMany({ where, orderBy: ORDER, ...args }), () => this.prisma.faq.count({ where }));
            return { ...page, items: page.items.map(admin_mapper_1.toFaqView) };
        };
        // Free-text searches are not cached (unbounded key space).
        if (q.q)
            return compute();
        const v = await this.cache.version(constants_1.ADMIN_CACHE.CONTENT);
        return this.cache.getOrSet(`cache:admin:faqs:v${v}:${q.category ?? 'all'}:${q.page}:${q.pageSize}`, constants_1.CONTENT_CACHE_TTL_SECONDS, compute);
    }
    async adminList(q) {
        const where = {
            deletedAt: null,
            ...(q.category ? { category: q.category } : {}),
            ...(q.isPublished !== undefined ? { isPublished: q.isPublished } : {}),
            ...searchWhere(q.q),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.faq.findMany({ where, orderBy: ORDER, ...args }), () => this.prisma.faq.count({ where }));
        return { ...page, items: page.items.map(admin_mapper_1.toAdminFaqView) };
    }
    async adminDetail(id) {
        return (0, admin_mapper_1.toAdminFaqView)(await this.load(id));
    }
    async create(dto) {
        const sortOrder = dto.sortOrder ??
            ((await this.prisma.faq.aggregate({
                where: { category: dto.category, deletedAt: null },
                _max: { sortOrder: true },
            }))._max.sortOrder ?? -1) + 1;
        const row = await this.prisma.faq.create({ data: { ...dto, sortOrder } });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return (0, admin_mapper_1.toAdminFaqView)(row);
    }
    async update(id, dto) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminFaqView)(before));
        const row = await this.prisma.faq.update({ where: { id }, data: dto });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return (0, admin_mapper_1.toAdminFaqView)(row);
    }
    async remove(id) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminFaqView)(before));
        await this.prisma.faq.update({ where: { id }, data: { deletedAt: new Date() } });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
    }
    /** sortOrder := position in `ids`. Every id must be a live FAQ. */
    async reorder(dto) {
        await this.prisma.$transaction(async (tx) => {
            const found = await tx.faq.findMany({
                where: { id: { in: dto.ids }, deletedAt: null },
                select: { id: true, sortOrder: true },
            });
            if (found.length !== dto.ids.length) {
                const known = new Set(found.map((f) => f.id));
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.FAQ_ORDER_INVALID, {
                    unknownIds: dto.ids.filter((id) => !known.has(id)),
                });
            }
            request_context_1.RequestContext.setAuditBefore(found);
            await tx.$executeRaw `
        UPDATE faqs AS f SET sort_order = (o.ord - 1)::int, updated_at = now()
        FROM unnest(${dto.ids}::uuid[]) WITH ORDINALITY AS o(id, ord)
        WHERE f.id = o.id`;
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.CONTENT);
        return { ids: dto.ids };
    }
    async load(id) {
        const row = await this.prisma.faq.findFirst({ where: { id, deletedAt: null } });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.FAQ_NOT_FOUND);
        return row;
    }
};
exports.FaqsService = FaqsService;
exports.FaqsService = FaqsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], FaqsService);
//# sourceMappingURL=faqs.service.js.map