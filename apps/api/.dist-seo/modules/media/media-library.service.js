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
var MediaLibraryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaLibraryService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const principal_1 = require("../../common/auth/principal");
const request_context_1 = require("../../common/context/request-context");
const app_exception_1 = require("../../common/errors/app.exception");
const pagination_1 = require("../../common/pagination/pagination");
const prisma_service_1 = require("../../prisma/prisma.service");
const media_files_1 = require("./media-files");
const media_storage_1 = require("./media-storage");
const media_mapper_1 = require("./media.mapper");
const media_selects_1 = require("./media.selects");
const EXT = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
};
const notFound = () => app_exception_1.AppException.notFound(shared_1.ErrorCode.MEDIA_NOT_FOUND);
/** Reading, listing, streaming and deleting uploads (user + admin side). */
let MediaLibraryService = MediaLibraryService_1 = class MediaLibraryService {
    constructor(prisma, storage, files, mapper) {
        this.prisma = prisma;
        this.storage = storage;
        this.files = files;
        this.mapper = mapper;
        this.logger = new common_1.Logger(MediaLibraryService_1.name);
    }
    listMine(user, q) {
        const where = {
            ownerUserId: user.userId,
            deletedAt: null,
            ...(q.purpose ? { purpose: { in: q.purpose } } : {}),
            ...(q.status ? { status: { in: q.status } } : {}),
        };
        return this.page(q, where, (row) => this.mapper.toOwnView(row));
    }
    /**
     * Owners see their uploads in any state; everyone else only READY public media of purposes that
     * are not owner-only (deal-request photos are shown through the deal-requests module).
     */
    async getForViewer(id, principal) {
        const row = await this.prisma.media.findFirst({
            where: { id, deletedAt: null },
            select: media_selects_1.mediaViewSelect,
        });
        if (!row)
            throw notFound();
        if ((0, principal_1.isUserPrincipal)(principal) && row.ownerUserId === principal.userId) {
            return this.mapper.toOwnView(row);
        }
        if (row.visibility !== shared_1.MediaVisibility.PUBLIC ||
            row.status !== shared_1.MediaStatus.READY ||
            shared_1.MEDIA_OWNER_ONLY_LOOKUP_PURPOSES.includes(row.purpose)) {
            throw notFound();
        }
        return this.mapper.toView(row);
    }
    /**
     * A private file for its uploader, or for staff (AGENT/AGENCY_OWNER) of the agency it is
     * attached to as a document. Anyone else gets 404.
     */
    async openPrivate(id, user) {
        const staffAgencyId = shared_1.AGENCY_ROLES.includes(user.role) ? user.agencyId : null;
        const row = await this.prisma.media.findFirst({
            where: {
                id,
                deletedAt: null,
                visibility: shared_1.MediaVisibility.PRIVATE,
                OR: [
                    { ownerUserId: user.userId },
                    ...(staffAgencyId ? [{ agencyDocuments: { some: { agencyId: staffAgencyId } } }] : []),
                ],
            },
            select: { id: true, status: true, storageKey: true, mimeType: true, visibility: true },
        });
        if (!row)
            throw notFound();
        return this.open(row);
    }
    // ---------- admin ----------
    listAll(q) {
        const where = {
            ...(q.includeDeleted ? {} : { deletedAt: null }),
            ...(q.purpose ? { purpose: { in: q.purpose } } : {}),
            ...(q.status ? { status: { in: q.status } } : {}),
            ...(q.visibility ? { visibility: q.visibility } : {}),
            ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
            ...(q.ownerAdminId ? { ownerAdminId: q.ownerAdminId } : {}),
            ...(q.orphaned === true ? media_selects_1.unattachedWhere : q.orphaned === false ? media_selects_1.attachedWhere : {}),
        };
        return this.page(q, where, (row) => this.mapper.toAdminView(row));
    }
    async getForAdmin(id) {
        const row = await this.prisma.media.findUnique({ where: { id }, select: media_selects_1.mediaViewSelect });
        if (!row)
            throw notFound();
        return this.mapper.toAdminView(row);
    }
    async openForAdmin(id) {
        const row = await this.prisma.media.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, status: true, storageKey: true, mimeType: true, visibility: true },
        });
        if (!row)
            throw notFound();
        return this.open(row);
    }
    // ---------- delete ----------
    deleteMine(id, user) {
        return this.softDelete(id, user.userId);
    }
    async deleteAsAdmin(id) {
        const before = await this.getForAdmin(id);
        if (before.deletedAt)
            throw notFound();
        request_context_1.RequestContext.setAuditBefore(before);
        await this.softDelete(id, null);
        return { ...before, deletedAt: new Date().toISOString() };
    }
    /**
     * Soft-deletes an unattached upload and removes its files right away (the row is purged by the
     * cleanup job later). The row is locked FOR UPDATE so a concurrent attach (FOR SHARE) either
     * finishes first — and the delete is refused — or waits and then sees the row deleted.
     */
    async softDelete(id, ownerUserId) {
        const row = await this.prisma.$transaction(async (tx) => {
            const locked = ownerUserId
                ? await tx.$queryRaw `
            SELECT id::text AS id FROM media
            WHERE id = ${id}::uuid AND owner_user_id = ${ownerUserId}::uuid AND deleted_at IS NULL
            FOR UPDATE`
                : await tx.$queryRaw `
            SELECT id::text AS id FROM media WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
            if (locked.length === 0)
                throw notFound();
            const current = await tx.media.findUniqueOrThrow({ where: { id }, select: media_selects_1.mediaViewSelect });
            if ((0, media_mapper_1.referenceTotal)(current) > 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.MEDIA_IN_USE);
            await tx.media.update({ where: { id }, data: { deletedAt: new Date() } });
            return current;
        });
        await this.files.removeAll(row).catch((err) => {
            // The purge phase of the cleanup job retries file removal.
            this.logger.error({ err, mediaId: id }, 'failed to remove media files');
        });
    }
    async open(row) {
        if (row.status !== shared_1.MediaStatus.READY)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.MEDIA_NOT_READY);
        const size = await this.storage.size(row.visibility, row.storageKey);
        if (size === null) {
            this.logger.error({ mediaId: row.id }, 'media file missing on disk');
            throw notFound();
        }
        return {
            stream: this.storage.open(row.visibility, row.storageKey),
            mimeType: row.mimeType,
            sizeBytes: size,
            filename: `media-${row.id}.${EXT[row.mimeType] ?? 'bin'}`,
        };
    }
    page(q, where, map) {
        return (0, pagination_1.paginate)(q, async (args) => (await this.prisma.media.findMany({
            where,
            select: media_selects_1.mediaViewSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        })).map(map), () => this.prisma.media.count({ where }));
    }
};
exports.MediaLibraryService = MediaLibraryService;
exports.MediaLibraryService = MediaLibraryService = MediaLibraryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_storage_1.MediaStorage,
        media_files_1.MediaFiles,
        media_mapper_1.MediaMapper])
], MediaLibraryService);
//# sourceMappingURL=media-library.service.js.map