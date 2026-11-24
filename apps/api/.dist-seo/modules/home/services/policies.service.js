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
exports.PoliciesService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const dto_1 = require("../dto");
const PUBLISHED_IMMUTABLE_MESSAGE = '게시된 정책 문서는 고칠 수 없습니다. 새 버전을 만들어 주세요.';
const notFound = () => app_exception_1.AppException.notFound(shared_1.ErrorCode.POLICY_NOT_FOUND);
function toPublic(d) {
    return {
        slug: d.slug,
        title: d.title,
        version: d.version,
        effectiveAt: d.effectiveAt.toISOString(),
        content: d.content,
    };
}
/**
 * Operating policy pages (허위매물 신고 정책 …), versioned like terms: the operator writes a draft,
 * publishes it (immutable from then on) and the site shows the latest published version whose
 * effectiveAt has passed; 404 until one exists ("준비 중" on the site).
 */
let PoliciesService = class PoliciesService {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async current(slug, now = new Date()) {
        if (!dto_1.policySlugSchema.safeParse(slug).success)
            throw notFound();
        const version = await this.cache.version(constants_1.HOME_CACHE.POLICIES);
        const doc = await this.cache.getOrSet(`cache:home:policy:v${version}:${slug}`, constants_1.HOME_CACHE_TTL_SECONDS.POLICY, async () => {
            const row = await this.currentRow(slug, now);
            return row ? toPublic(row) : null;
        });
        if (!doc)
            throw notFound();
        return doc;
    }
    // ---- admin ----------------------------------------------------------------------------------
    async list(q) {
        const where = q.slug ? { slug: q.slug } : {};
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.policyDocument.findMany({
            where,
            orderBy: [{ slug: 'asc' }, { effectiveAt: 'desc' }, { createdAt: 'desc' }],
            ...args,
        }), () => this.prisma.policyDocument.count({ where }));
        const currentIds = await this.currentIds([...new Set(page.items.map((d) => d.slug))]);
        return { ...page, items: page.items.map((d) => this.toAdmin(d, currentIds)) };
    }
    async detail(id) {
        const row = await this.prisma.policyDocument.findUnique({ where: { id } });
        if (!row)
            throw notFound();
        return this.toAdmin(row, await this.currentIds([row.slug]));
    }
    async create(dto) {
        const row = await this.prisma.policyDocument.create({
            data: { ...dto, effectiveAt: new Date(dto.effectiveAt) },
        });
        return this.detail(row.id);
    }
    async update(id, dto) {
        const before = await this.detail(id);
        if (before.publishedAt) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.CONFLICT, { message: PUBLISHED_IMMUTABLE_MESSAGE });
        }
        request_context_1.RequestContext.setAuditBefore(before);
        const { count } = await this.prisma.policyDocument.updateMany({
            where: { id, publishedAt: null },
            data: {
                ...(dto.title !== undefined ? { title: dto.title } : {}),
                ...(dto.content !== undefined ? { content: dto.content } : {}),
                ...(dto.effectiveAt !== undefined ? { effectiveAt: new Date(dto.effectiveAt) } : {}),
            },
        });
        if (count === 0) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.CONFLICT, { message: PUBLISHED_IMMUTABLE_MESSAGE });
        }
        return this.detail(id);
    }
    async publish(id, now = new Date()) {
        const before = await this.detail(id);
        if (before.publishedAt)
            return before;
        request_context_1.RequestContext.setAuditBefore(before);
        await this.prisma.policyDocument.updateMany({
            where: { id, publishedAt: null },
            data: { publishedAt: now },
        });
        await this.cache.bump(constants_1.HOME_CACHE.POLICIES);
        return this.detail(id);
    }
    /** Drafts only; published versions stay as the record of what was shown. */
    async remove(id) {
        const before = await this.detail(id);
        if (before.publishedAt) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.CONFLICT, { message: PUBLISHED_IMMUTABLE_MESSAGE });
        }
        request_context_1.RequestContext.setAuditBefore(before);
        await this.prisma.policyDocument.deleteMany({ where: { id, publishedAt: null } });
    }
    currentRow(slug, now) {
        return this.prisma.policyDocument.findFirst({
            where: { slug, publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
            orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }],
        });
    }
    async currentIds(slugs, now = new Date()) {
        const rows = await Promise.all(slugs.map((s) => this.currentRow(s, now)));
        return new Set(rows.flatMap((r) => (r ? [r.id] : [])));
    }
    toAdmin(d, currentIds) {
        return {
            id: d.id,
            ...toPublic(d),
            publishedAt: d.publishedAt?.toISOString() ?? null,
            isCurrent: currentIds.has(d.id),
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
        };
    }
};
exports.PoliciesService = PoliciesService;
exports.PoliciesService = PoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], PoliciesService);
//# sourceMappingURL=policies.service.js.map