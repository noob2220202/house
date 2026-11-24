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
exports.MediaServiceDealRequestMedia = exports.DEAL_REQUEST_MEDIA = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const media_service_1 = require("../../media/media.service");
exports.DEAL_REQUEST_MEDIA = Symbol('DEAL_REQUEST_MEDIA');
let MediaServiceDealRequestMedia = class MediaServiceDealRequestMedia {
    constructor(prisma, media) {
        this.prisma = prisma;
        this.media = media;
    }
    async assertPhotosUsable(mediaIds, userId, db) {
        if (mediaIds.length === 0)
            return;
        const check = (tx) => this.media.assertUsable(mediaIds, {
            purpose: shared_1.MediaPurpose.DEAL_REQUEST_PHOTO,
            ownerUserId: userId,
            unattached: true,
            errorCode: shared_1.ErrorCode.DEAL_REQUEST_PHOTO_INVALID,
        }, tx);
        // Without a caller transaction this is only a pre-check (the locked check runs again later).
        if (db)
            await check(db);
        else
            await this.prisma.$transaction(check);
    }
    async discardPhotos(dealRequestIds, now, db) {
        if (dealRequestIds.length === 0)
            return 0;
        const photos = await db.dealRequestPhoto.findMany({
            where: { dealRequestId: { in: [...dealRequestIds] } },
            select: { mediaId: true },
        });
        if (photos.length === 0)
            return 0;
        const mediaIds = photos.map((p) => p.mediaId);
        await db.dealRequestPhoto.deleteMany({ where: { dealRequestId: { in: [...dealRequestIds] } } });
        await db.media.updateMany({
            where: { id: { in: mediaIds }, deletedAt: null },
            data: { deletedAt: now },
        });
        return photos.length;
    }
    publicUrl(media, variant = 'medium') {
        return this.media.url(media, variant);
    }
};
exports.MediaServiceDealRequestMedia = MediaServiceDealRequestMedia;
exports.MediaServiceDealRequestMedia = MediaServiceDealRequestMedia = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_service_1.MediaService])
], MediaServiceDealRequestMedia);
//# sourceMappingURL=media.port.js.map