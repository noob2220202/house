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
exports.MediaServiceAdsMedia = exports.ADS_MEDIA = exports.adMediaSelect = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const media_service_1 = require("../../media/media.service");
/** Media columns needed to build public URLs. */
exports.adMediaSelect = {
    id: true,
    storageKey: true,
    variants: true,
    width: true,
    height: true,
};
exports.ADS_MEDIA = Symbol('ADS_MEDIA');
let MediaServiceAdsMedia = class MediaServiceAdsMedia {
    constructor(media) {
        this.media = media;
    }
    async assertUsable(mediaIds, purpose, tx) {
        await this.media.assertUsable(mediaIds, {
            purpose,
            errorCode: purpose === shared_1.MediaPurpose.BANNER
                ? shared_1.ErrorCode.BANNER_MEDIA_INVALID
                : shared_1.ErrorCode.POPUP_MEDIA_INVALID,
        }, tx);
    }
    released(mediaIds, tx) {
        return this.media.released(mediaIds, tx);
    }
    url(media, variant = 'large') {
        return this.media.url(media, variant);
    }
    view(media) {
        return { id: media.id, url: this.url(media), width: media.width, height: media.height };
    }
};
exports.MediaServiceAdsMedia = MediaServiceAdsMedia;
exports.MediaServiceAdsMedia = MediaServiceAdsMedia = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_service_1.MediaService])
], MediaServiceAdsMedia);
//# sourceMappingURL=ads-media.port.js.map