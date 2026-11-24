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
exports.MediaService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../common/errors/app.exception");
const prisma_service_1 = require("../../prisma/prisma.service");
const media_storage_1 = require("./media-storage");
const media_mapper_1 = require("./media.mapper");
const media_selects_1 = require("./media.selects");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * What other modules use from the media domain. Attach/detach semantics:
 *  - attach = inside your transaction, `assertUsable(ids, rule, tx)` (locks the rows so they cannot
 *    be deleted concurrently), then create your FK row (ListingPhoto, Banner.pcMediaId…) with the
 *    SAME `tx`. A DB trigger also refuses any new reference to a soft-deleted row.
 *  - detach = delete/clear your FK row, then `released(ids, tx)` so the orphan grace period
 *    (MEDIA_ORPHAN_GRACE_HOURS) restarts; unreferenced uploads are collected by the cleanup job.
 * "Attached" is always derived from the FK relations, never from a flag that could drift.
 */
let MediaService = class MediaService {
    constructor(prisma, storage, mapper) {
        this.prisma = prisma;
        this.storage = storage;
        this.mapper = mapper;
    }
    /**
     * Throws (400) unless every id is a live, READY upload satisfying `rule`. Returns rows in input
     * order. With a transaction client the rows stay locked until it commits: FOR SHARE (blocks
     * deletes and cleanup), or FOR UPDATE for `unattached` rules so two transactions cannot both
     * claim the same one-shot upload. Locks are taken in id order (no deadlocks between attachers).
     */
    async assertUsable(mediaIds, rule, db = this.prisma) {
        const ids = [...new Set(mediaIds)];
        if (ids.length === 0)
            return [];
        const inTx = db !== this.prisma;
        if (rule.unattached && !inTx) {
            // An unlocked "not attached yet" check proves nothing by the time the FK row is written.
            throw new Error('MediaService.assertUsable: `unattached` requires a transaction client');
        }
        const fail = () => app_exception_1.AppException.badRequest(rule.errorCode ?? shared_1.ErrorCode.MEDIA_INVALID);
        if (!ids.every((id) => UUID.test(id)))
            throw fail();
        if (inTx) {
            const sorted = ids.map((id) => id.toLowerCase()).sort();
            if (rule.unattached) {
                await db.$queryRaw `
          SELECT id FROM media WHERE id = ANY(${sorted}::uuid[]) ORDER BY id FOR UPDATE`;
            }
            else {
                await db.$queryRaw `
          SELECT id FROM media WHERE id = ANY(${sorted}::uuid[]) ORDER BY id FOR SHARE`;
            }
        }
        const purposes = typeof rule.purpose === 'string' ? [rule.purpose] : [...rule.purpose];
        const visibilities = [...new Set(purposes.map(shared_1.mediaVisibilityFor))];
        const owner = [];
        if (rule.ownerUserId) {
            owner.push(rule.orWhere
                ? { OR: [{ ownerUserId: rule.ownerUserId }, rule.orWhere] }
                : { ownerUserId: rule.ownerUserId });
        }
        else if (rule.orWhere) {
            owner.push(rule.orWhere);
        }
        const rows = await db.media.findMany({
            where: {
                id: { in: ids },
                deletedAt: null,
                status: shared_1.MediaStatus.READY,
                purpose: { in: purposes },
                visibility: { in: visibilities },
                AND: [...owner, ...(rule.unattached ? [media_selects_1.unattachedWhere] : [])],
            },
            select: media_selects_1.mediaRefSelect,
        });
        if (rows.length !== ids.length)
            throw fail();
        const byId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));
        return ids
            .map((id) => byId.get(id.toLowerCase()))
            .filter((r) => r !== undefined);
    }
    /** Call after removing a reference: restarts the orphan grace period of those uploads. */
    async released(mediaIds, db = this.prisma) {
        const ids = [...new Set(mediaIds)].filter((id) => UUID.test(id));
        if (ids.length === 0)
            return;
        await db.media.updateMany({
            where: { id: { in: ids }, deletedAt: null },
            data: { updatedAt: new Date() },
        });
    }
    /**
     * Member withdrawal (PII scrub job, inside its transaction): forgets the uploaded file names of
     * all of the user's uploads (often real names, e.g. `홍길동_등록증.pdf`) and soft-deletes every
     * upload that is not attached anywhere, so the cleanup purge removes the files within the grace
     * period. Attached uploads stay (they belong to listings/agencies now, and agency documents follow
     * the registration-record retention policy); they are removed when their owner detaches them.
     */
    async scrubOwner(userId, db, now = new Date()) {
        if (!UUID.test(userId))
            return { filenamesCleared: 0, deleted: 0 };
        // Same lock order as softDelete/cleanup (row locks), so a concurrent attach either commits
        // first (row stays: attached) or sees the row deleted afterwards (guard trigger refuses).
        await db.$queryRaw `
      SELECT id FROM media WHERE owner_user_id = ${userId}::uuid AND deleted_at IS NULL
      ORDER BY id FOR UPDATE`;
        const cleared = await db.media.updateMany({
            where: { ownerUserId: userId, originalFilename: { not: null } },
            data: { originalFilename: null },
        });
        const deleted = await db.media.updateMany({
            where: { ownerUserId: userId, deletedAt: null, ...media_selects_1.unattachedWhere },
            data: { deletedAt: now },
        });
        return { filenamesCleared: cleared.count, deleted: deleted.count };
    }
    /** Public URL of a variant (falls back to the full-size image). */
    url(ref, variant = 'large') {
        return this.mapper.url(ref, variant);
    }
    variantUrls(ref) {
        return this.mapper.variantUrls(ref);
    }
    /** Public views of READY public media, in input order (unknown/private ids are skipped). */
    async views(mediaIds) {
        const ids = [...new Set(mediaIds)].filter((id) => UUID.test(id));
        if (ids.length === 0)
            return [];
        const rows = await this.prisma.media.findMany({
            where: { id: { in: ids }, deletedAt: null, status: shared_1.MediaStatus.READY, visibility: 'PUBLIC' },
            select: media_selects_1.mediaViewSelect,
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return ids.flatMap((id) => {
            const row = byId.get(id);
            return row ? [this.mapper.toView(row)] : [];
        });
    }
    /** Absolute path of a PRIVATE file, guaranteed inside PRIVATE_UPLOAD_DIR (null otherwise). */
    privateFilePath(storageKey) {
        return this.storage.resolve('PRIVATE', storageKey);
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_storage_1.MediaStorage,
        media_mapper_1.MediaMapper])
], MediaService);
//# sourceMappingURL=media.service.js.map