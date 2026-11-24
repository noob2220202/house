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
exports.AdminTermsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../../common/audit/audit.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_1 = require("../../auth");
/**
 * Terms authoring. Documents are immutable once published: a change is a new version. Publishing a
 * required version makes every user who agreed only to older versions show up in
 * `/auth/me.pendingRequiredTerms` from its effectiveAt on (the auth module computes that from the
 * current documents, so there is no flag to flip per user).
 */
let AdminTermsService = class AdminTermsService {
    constructor(prisma, terms, audit) {
        this.prisma = prisma;
        this.terms = terms;
        this.audit = audit;
    }
    async list(q) {
        const where = {
            ...(q.type ? { type: q.type } : {}),
            ...(q.published === true ? { publishedAt: { not: null } } : {}),
            ...(q.published === false ? { publishedAt: null } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.termsDocument.findMany({
            where,
            orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { createdAt: 'desc' }],
            ...args,
        }), () => this.prisma.termsDocument.count({ where }));
        const ctx = await this.context(page.items.map((d) => d.id));
        return { ...page, items: page.items.map((d) => this.view(d, ctx)) };
    }
    async detail(id) {
        const doc = await this.load(id);
        return this.view(doc, await this.context([doc.id]));
    }
    async create(dto) {
        this.assertRequirable(dto.type, dto.isRequired);
        try {
            const doc = await this.prisma.termsDocument.create({
                data: { ...dto, effectiveAt: new Date(dto.effectiveAt) },
            });
            return this.detail(doc.id);
        }
        catch (err) {
            throw this.mapDuplicate(err);
        }
    }
    async update(id, dto) {
        const before = await this.loadDraft(id);
        this.assertRequirable(before.type, dto.isRequired ?? before.isRequired);
        request_context_1.RequestContext.setAuditBefore(await this.detail(before.id));
        try {
            await this.prisma.termsDocument.update({
                where: { id },
                data: {
                    ...dto,
                    ...(dto.effectiveAt ? { effectiveAt: new Date(dto.effectiveAt) } : {}),
                },
            });
        }
        catch (err) {
            throw this.mapDuplicate(err);
        }
        return this.detail(id);
    }
    /**
     * Publishes a draft. effectiveAt must be
     *  - not in the past (a version never becomes current retroactively),
     *  - later than every published version of the same type (versions stay ordered, "current" is
     *    unambiguous), and
     *  - for a revision of an already published type, at least TERMS_NOTICE_DAYS away so users get
     *    advance notice (scheduled versions are readable before they take effect) — unless
     *    `urgent` with a reason, which the audit row records.
     */
    async publish(id, dto, now = new Date()) {
        const before = await this.detail((await this.loadDraft(id)).id);
        await this.prisma.$transaction(async (tx) => {
            const draft = await this.loadDraft(id, tx);
            // Drafts saved before this rule existed must not become a mandatory marketing/location consent.
            this.assertRequirable(draft.type, draft.isRequired);
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`terms:${draft.type}`}))`;
            const latest = await tx.termsDocument.findFirst({
                where: { type: draft.type, publishedAt: { not: null } },
                orderBy: { effectiveAt: 'desc' },
                select: { id: true, version: true, effectiveAt: true },
            });
            const effectiveAt = draft.effectiveAt.getTime();
            if (effectiveAt < now.getTime()) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.TERMS_EFFECTIVE_AT_INVALID, { reason: 'PAST' });
            }
            if (latest && effectiveAt <= latest.effectiveAt.getTime()) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.TERMS_EFFECTIVE_AT_INVALID, {
                    reason: 'NOT_AFTER_LATEST',
                    latestVersion: latest.version,
                    latestEffectiveAt: latest.effectiveAt.toISOString(),
                });
            }
            const earliest = now.getTime() + shared_1.TERMS_NOTICE_DAYS * 86_400_000;
            if (latest && !dto.urgent && effectiveAt < earliest) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.TERMS_EFFECTIVE_AT_INVALID, {
                    reason: 'NOTICE_PERIOD',
                    noticeDays: shared_1.TERMS_NOTICE_DAYS,
                    earliestEffectiveAt: new Date(earliest).toISOString(),
                });
            }
            const { count } = await tx.termsDocument.updateMany({
                where: { id, publishedAt: null },
                data: { publishedAt: now },
            });
            if (count === 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.TERMS_ALREADY_PUBLISHED);
            const { content: _content, ...snapshot } = before;
            await this.audit.record({
                action: 'terms.publish',
                resourceType: 'TermsDocument',
                resourceId: id,
                before: snapshot,
                after: {
                    ...snapshot,
                    publishedAt: now.toISOString(),
                    noticeDays: Math.floor((effectiveAt - now.getTime()) / 86_400_000),
                    urgent: dto.urgent,
                    urgentReason: dto.urgent ? (dto.reason ?? null) : null,
                },
            }, tx);
        });
        return this.detail(id);
    }
    async remove(id) {
        const draft = await this.loadDraft(id);
        request_context_1.RequestContext.setAuditBefore(await this.detail(draft.id));
        const { count } = await this.prisma.termsDocument.deleteMany({
            where: { id, publishedAt: null },
        });
        if (count === 0)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.TERMS_ALREADY_PUBLISHED);
    }
    view(d, ctx) {
        return {
            id: d.id,
            type: d.type,
            version: d.version,
            title: d.title,
            content: d.content,
            isRequired: d.isRequired,
            effectiveAt: d.effectiveAt.toISOString(),
            publishedAt: d.publishedAt?.toISOString() ?? null,
            isCurrent: ctx.currentIds.has(d.id),
            requiresReconsent: d.isRequired && ctx.latestPublishedIds.has(d.id),
            consentCount: ctx.consentCounts.get(d.id) ?? 0,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
        };
    }
    async context(ids) {
        const [current, latest, counts] = await Promise.all([
            this.terms.currentAll(),
            this.prisma.termsDocument.findMany({
                where: { publishedAt: { not: null } },
                orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }],
                distinct: ['type'],
                select: { id: true, type: true },
            }),
            ids.length === 0
                ? Promise.resolve([])
                : this.prisma.userConsent.groupBy({
                    by: ['termsDocumentId'],
                    where: { termsDocumentId: { in: ids }, agreed: true },
                    _count: { _all: true },
                }),
        ]);
        return {
            currentIds: new Set(current.map((d) => d.id)),
            latestPublishedIds: new Set(latest.map((d) => d.id)),
            consentCounts: new Map(counts.map((c) => [c.termsDocumentId, c._count._all])),
        };
    }
    mapDuplicate(err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return app_exception_1.AppException.conflict(shared_1.ErrorCode.TERMS_VERSION_DUPLICATE);
        }
        return err;
    }
    /** MARKETING / LOCATION consent is optional by law/design (see OPTIONAL_ONLY_TERMS_TYPES). */
    assertRequirable(type, isRequired) {
        if (isRequired && !(0, shared_1.canTermsTypeBeRequired)(type)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.TERMS_OPTIONAL_ONLY, { type });
        }
    }
    async load(id, db = this.prisma) {
        const doc = await db.termsDocument.findUnique({ where: { id } });
        if (!doc)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.TERMS_NOT_FOUND);
        return doc;
    }
    async loadDraft(id, db = this.prisma) {
        const doc = await this.load(id, db);
        if (doc.publishedAt)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.TERMS_ALREADY_PUBLISHED);
        return doc;
    }
};
exports.AdminTermsService = AdminTermsService;
exports.AdminTermsService = AdminTermsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_1.TermsService,
        audit_service_1.AuditService])
], AdminTermsService);
//# sourceMappingURL=admin-terms.service.js.map