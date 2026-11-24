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
exports.TermsService = void 0;
exports.toTermsSummary = toTermsSummary;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_exception_1 = require("../../../common/errors/app.exception");
const request_context_1 = require("../../../common/context/request-context");
const prisma_service_1 = require("../../../prisma/prisma.service");
/** Display order of terms types (이용약관 → 개인정보 → 위치기반 → 마케팅 → purpose consents). */
const TYPE_ORDER = Object.values(shared_1.TermsType);
const ALL_TERMS_TYPES = TYPE_ORDER;
function toTermsSummary(d) {
    return {
        id: d.id,
        type: d.type,
        version: d.version,
        title: d.title,
        isRequired: d.isRequired,
        effectiveAt: d.effectiveAt.toISOString(),
    };
}
/**
 * Terms documents (read side; authoring lives in the admin module) and append-only consent records.
 * "Current" = published, effective now, latest effectiveAt per type.
 *
 * Two kinds of documents share the table (shared ACCOUNT_TERMS_TYPES / ACTION_CONSENT_TERMS):
 *  - account terms (이용약관 …): signup, /me/consents, GET /terms and the write guard use only these;
 *  - purpose consents (D8): agreed with one submission (등록 신청, 합류, 내놓기·구하기) through
 *    `consentForAction`, which checks the version the user saw and records it with that submission.
 */
let TermsService = class TermsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Current documents of the given types (default: account terms), in display order. */
    async current(now = new Date(), db = this.prisma, types = shared_1.ACCOUNT_TERMS_TYPES) {
        const docs = await db.termsDocument.findMany({
            where: {
                type: { in: [...types] },
                publishedAt: { not: null, lte: now },
                effectiveAt: { lte: now },
            },
            orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { createdAt: 'desc' }],
            distinct: ['type'],
        });
        return docs.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    }
    /** Current documents of every type, purpose consents included (admin views). */
    currentAll(now = new Date(), db = this.prisma) {
        return this.current(now, db, ALL_TERMS_TYPES);
    }
    /**
     * Purpose consents of one submission (D8). Every type in `types` must be given exactly at the
     * version that is current at `now`:
     *  - no published document for a type → 503 AUTH_CONSENT_UNAVAILABLE (nothing to agree to);
     *  - a type missing from `given` → 400 AUTH_CONSENT_REQUIRED `{ missing }`;
     *  - an older / unknown version (the form was open while a new version took effect) →
     *    400 AUTH_CONSENT_OUTDATED `{ outdated: [{ type, version, currentVersion }] }`;
     *  - a type that the action does not ask for → 400 AUTH_TERMS_INVALID.
     * Pass the submission's transaction as `db` and call `record()` with the result in it, or use
     * `consentForAction`, so the consent rows commit together with what they consent to.
     */
    async verifyActionConsents(types, given, now = new Date(), db = this.prisma) {
        const foreign = given.find((c) => !types.includes(c.type));
        if (foreign)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_TERMS_INVALID, { type: foreign.type });
        const current = new Map((await this.current(now, db, types)).map((d) => [d.type, d]));
        const unavailable = types.filter((t) => !current.has(t));
        if (unavailable.length > 0) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.AUTH_CONSENT_UNAVAILABLE, {
                details: { types: unavailable },
            });
        }
        const byType = new Map(given.map((c) => [c.type, c.version]));
        const missing = types.filter((t) => !byType.has(t));
        if (missing.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_CONSENT_REQUIRED, { missing });
        }
        const outdated = [];
        const decisions = [];
        for (const [type, doc] of current) {
            const version = byType.get(type) ?? '';
            if (version !== doc.version)
                outdated.push({ type, version, currentVersion: doc.version });
            else
                decisions.push({ termsDocumentId: doc.id, agreed: true });
        }
        if (outdated.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_CONSENT_OUTDATED, { outdated });
        }
        return decisions;
    }
    /** verifyActionConsents + record, inside the caller's transaction. */
    async consentForAction(tx, userId, types, given, now = new Date()) {
        await this.record(tx, userId, await this.verifyActionConsents(types, given, now, tx));
    }
    /**
     * Every published version of a type (history selector), newest first, without content.
     * `isCurrent` marks the version in force now; announced versions (published, effective later)
     * are listed too.
     */
    async versions(type, now = new Date()) {
        const docs = await this.prisma.termsDocument.findMany({
            where: { type, publishedAt: { not: null, lte: now } },
            orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
        });
        const current = docs.find((d) => d.effectiveAt <= now);
        return docs.map((d) => ({ ...toTermsSummary(d), isCurrent: d.id === current?.id }));
    }
    async listCurrent() {
        return (await this.current()).map(toTermsSummary);
    }
    /**
     * Current version of a type, or a specific published version (history view). Serves account terms
     * and purpose consents alike (the forms read the version to send back from here).
     */
    async getByType(type, version) {
        const now = new Date();
        const doc = version
            ? await this.prisma.termsDocument.findFirst({
                where: { type, version, publishedAt: { not: null, lte: now } },
            })
            : await this.prisma.termsDocument.findFirst({
                where: { type, publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
                orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
            });
        if (!doc)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AUTH_TERMS_NOT_FOUND);
        return { ...toTermsSummary(doc), content: doc.content };
    }
    /**
     * Checks consent decisions against the current documents.
     *  - every referenced document must be a current one (stale tab → AUTH_TERMS_INVALID)
     *  - a required document can't be declined (AUTH_REQUIRED_TERMS_REVOKE)
     *  - with `requireAll`, every current required document must be agreed (AUTH_TERMS_REQUIRED)
     */
    validate(current, decisions, opts) {
        const byId = new Map(current.map((d) => [d.id, d]));
        const seen = new Set();
        for (const c of decisions) {
            const doc = byId.get(c.termsDocumentId);
            if (!doc || seen.has(c.termsDocumentId)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_TERMS_INVALID, {
                    termsDocumentId: c.termsDocumentId,
                });
            }
            seen.add(c.termsDocumentId);
            if (doc.isRequired && !c.agreed) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_REQUIRED_TERMS_REVOKE, { type: doc.type });
            }
        }
        if (opts.requireAll) {
            const agreed = new Set(decisions.filter((c) => c.agreed).map((c) => c.termsDocumentId));
            const missing = current.filter((d) => d.isRequired && !agreed.has(d.id)).map((d) => d.type);
            if (missing.length > 0) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_TERMS_REQUIRED, { missing });
            }
        }
        return byId;
    }
    async record(tx, userId, decisions) {
        if (decisions.length === 0)
            return;
        const ctx = request_context_1.RequestContext.current();
        await tx.userConsent.createMany({
            data: decisions.map((c) => ({
                userId,
                termsDocumentId: c.termsDocumentId,
                agreed: c.agreed,
                ip: ctx?.ip?.slice(0, 64) ?? null,
                userAgent: ctx?.userAgent?.slice(0, 500) ?? null,
            })),
        });
    }
    /** Latest decision per document for the given ids. */
    async latestDecisions(userId, termsDocumentIds, db = this.prisma) {
        if (termsDocumentIds.length === 0)
            return new Map();
        const rows = await db.userConsent.findMany({
            where: { userId, termsDocumentId: { in: termsDocumentIds } },
            orderBy: [{ termsDocumentId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
            distinct: ['termsDocumentId'],
            select: { termsDocumentId: true, agreed: true, createdAt: true },
        });
        return new Map(rows.map((r) => [r.termsDocumentId, r]));
    }
    async status(userId) {
        const current = await this.current();
        const latest = await this.latestDecisions(userId, current.map((d) => d.id));
        return current.map((d) => {
            const decision = latest.get(d.id);
            return {
                terms: toTermsSummary(d),
                agreed: decision?.agreed ?? false,
                decidedAt: decision?.createdAt.toISOString() ?? null,
            };
        });
    }
    /**
     * Required types whose current version the user has not (or no longer) agreed to.
     * `required` (the current required documents) may be passed when the caller already has it.
     */
    async pendingRequired(userId, required) {
        required ??= (await this.current()).filter((d) => d.isRequired);
        const latest = await this.latestDecisions(userId, required.map((d) => d.id));
        return required.filter((d) => latest.get(d.id)?.agreed !== true).map((d) => d.type);
    }
};
exports.TermsService = TermsService;
exports.TermsService = TermsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TermsService);
//# sourceMappingURL=terms.service.js.map