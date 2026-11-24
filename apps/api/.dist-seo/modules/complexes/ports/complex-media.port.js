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
exports.MediaServiceComplexMedia = exports.COMPLEX_MEDIA = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const media_service_1 = require("../../media/media.service");
exports.COMPLEX_MEDIA = Symbol('COMPLEX_MEDIA');
let MediaServiceComplexMedia = class MediaServiceComplexMedia {
    constructor(media) {
        this.media = media;
    }
    async assertUsable(mediaIds, tx) {
        await this.media.assertUsable(mediaIds, { purpose: shared_1.MediaPurpose.COMPLEX_PHOTO, errorCode: shared_1.ErrorCode.COMPLEX_MEDIA_INVALID }, tx);
    }
    released(mediaIds, tx) {
        return this.media.released(mediaIds, tx);
    }
    urls(media) {
        const v = this.media.variantUrls(media);
        return { thumbUrl: v.thumb, mediumUrl: v.medium, largeUrl: v.large };
    }
};
exports.MediaServiceComplexMedia = MediaServiceComplexMedia;
exports.MediaServiceComplexMedia = MediaServiceComplexMedia = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_service_1.MediaService])
], MediaServiceComplexMedia);
//# sourceMappingURL=complex-media.port.js.map