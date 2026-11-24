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
var MediaCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaCleanupService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const constants_1 = require("./constants");
const media_files_1 = require("./media-files");
const media_selects_1 = require("./media.selects");
/**
 * Orphan cleanup (idempotent, safe to run concurrently):
 *  1. PENDING uploads older than the grace period (lost jobs) → FAILED.
 *  2. Unattached uploads whose last attach/detach is older than the grace period → soft-deleted.
 *  3. Soft-deleted rows older than the grace period → files removed, row purged.
 * Rows are locked (FOR UPDATE SKIP LOCKED) and the orphan condition re-checked under the lock, so
 * an upload being attached concurrently (MediaService.assertUsable and the reference guard trigger
 * hold FOR SHARE) is never taken; an attach that comes after the soft-delete is refused by the
 * trigger. Soft-deleted rows that are still referenced (should not exist) are never purged and are
 * reported in the log.
 */
let MediaCleanupService = MediaCleanupService_1 = class MediaCleanupService {
    constructor(prisma, files) {
        this.prisma = prisma;
        this.files = files;
        this.logger = new common_1.Logger(MediaCleanupService_1.name);
    }
    async run(now = new Date()) {
        const cutoff = new Date(now.getTime() - shared_1.MEDIA_ORPHAN_GRACE_HOURS * 3_600_000);
        const stale = await this.prisma.media.updateMany({
            where: { status: shared_1.MediaStatus.PENDING, deletedAt: null, createdAt: { lt: cutoff } },
            data: {
                status: shared_1.MediaStatus.FAILED,
                error: shared_1.ERROR_MESSAGES[shared_1.ErrorCode.MEDIA_PROCESSING_FAILED],
            },
        });
        const candidates = await this.prisma.media.findMany({
            where: (0, media_selects_1.orphanWhere)(cutoff),
            select: { id: true },
            orderBy: { updatedAt: 'asc' },
            take: constants_1.CLEANUP_BATCH_SIZE,
        });
        let orphaned = 0;
        if (candidates.length > 0) {
            orphaned = await this.prisma.$transaction(async (tx) => {
                const ids = candidates.map((c) => c.id);
                const locked = await tx.$queryRaw `
          SELECT id::text AS id FROM media WHERE id = ANY(${ids}::uuid[]) FOR UPDATE SKIP LOCKED`;
                if (locked.length === 0)
                    return 0;
                const res = await tx.media.updateMany({
                    where: { id: { in: locked.map((l) => l.id) }, ...(0, media_selects_1.orphanWhere)(cutoff) },
                    data: { deletedAt: now },
                });
                return res.count;
            });
        }
        const purged = await this.purge(cutoff);
        await this.reportDeletedButReferenced();
        const result = { orphaned, staleFailed: stale.count, purged };
        if (orphaned + stale.count + purged > 0)
            this.logger.log(result, 'media cleanup');
        return result;
    }
    async reportDeletedButReferenced() {
        const rows = await this.prisma.media.findMany({
            where: { deletedAt: { not: null }, ...media_selects_1.attachedWhere },
            select: { id: true },
            take: 20,
        });
        if (rows.length > 0) {
            this.logger.warn({ mediaIds: rows.map((r) => r.id) }, 'soft-deleted media is still referenced; kept (needs manual repair)');
        }
    }
    async purge(cutoff) {
        const rows = await this.prisma.media.findMany({
            where: { deletedAt: { lt: cutoff }, ...media_selects_1.unattachedWhere },
            select: { id: true, storageKey: true, visibility: true },
            orderBy: { deletedAt: 'asc' },
            take: constants_1.CLEANUP_BATCH_SIZE,
        });
        let purged = 0;
        for (const row of rows) {
            await this.files.removeAll(row);
            try {
                const res = await this.prisma.media.deleteMany({
                    where: { id: row.id, deletedAt: { not: null }, ...media_selects_1.unattachedWhere },
                });
                purged += res.count;
            }
            catch (err) {
                // A reference appeared in between (FK Restrict): keep the row, it is in use again.
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2003')
                    continue;
                throw err;
            }
        }
        return purged;
    }
};
exports.MediaCleanupService = MediaCleanupService;
exports.MediaCleanupService = MediaCleanupService = MediaCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_files_1.MediaFiles])
], MediaCleanupService);
//# sourceMappingURL=media-cleanup.service.js.map