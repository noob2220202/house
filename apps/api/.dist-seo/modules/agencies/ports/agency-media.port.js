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
exports.MediaServiceAgencyMedia = exports.AGENCY_MEDIA = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const media_service_1 = require("../../media/media.service");
exports.AGENCY_MEDIA = Symbol('AGENCY_MEDIA');
let MediaServiceAgencyMedia = class MediaServiceAgencyMedia {
    constructor(media) {
        this.media = media;
    }
    async assertDocumentsUsable(mediaIds, userId, tx) {
        await this.media.assertUsable(mediaIds, {
            purpose: shared_1.MediaPurpose.AGENCY_DOCUMENT,
            ownerUserId: userId,
            unattached: true,
            errorCode: shared_1.ErrorCode.AGENCY_DOCUMENT_INVALID,
        }, tx);
    }
    async assertLogoUsable(mediaId, userId, tx) {
        await this.media.assertUsable([mediaId], {
            purpose: shared_1.MediaPurpose.AGENCY_LOGO,
            ownerUserId: userId,
            errorCode: shared_1.ErrorCode.AGENCY_LOGO_INVALID,
        }, tx);
    }
    async assertCoverUsable(mediaId, userId, tx) {
        await this.media.assertUsable([mediaId], {
            purpose: [shared_1.MediaPurpose.AGENCY_COVER, shared_1.MediaPurpose.AGENCY_LOGO],
            ownerUserId: userId,
            errorCode: shared_1.ErrorCode.AGENCY_COVER_INVALID,
        }, tx);
    }
    released(mediaIds, tx) {
        return this.media.released(mediaIds, tx);
    }
    publicUrl(media, variant = 'thumb') {
        return this.media.url(media, variant);
    }
    privateFilePath(storageKey) {
        return this.media.privateFilePath(storageKey);
    }
};
exports.MediaServiceAgencyMedia = MediaServiceAgencyMedia;
exports.MediaServiceAgencyMedia = MediaServiceAgencyMedia = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_service_1.MediaService])
], MediaServiceAgencyMedia);
//# sourceMappingURL=agency-media.port.js.map