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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdsMapper = exports.publicPopupSelect = exports.adminPopupSelect = exports.publicBannerSelect = exports.adminBannerSelect = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../config/app-config.service");
const ads_media_port_1 = require("./ports/ads-media.port");
exports.adminBannerSelect = {
    id: true,
    slot: true,
    title: true,
    advertiserName: true,
    linkUrl: true,
    newWindow: true,
    startAt: true,
    endAt: true,
    paused: true,
    priority: true,
    sortOrder: true,
    targeting: true,
    memo: true,
    createdByAdminId: true,
    createdAt: true,
    updatedAt: true,
    agency: { select: { id: true, name: true } },
    pcMedia: { select: ads_media_port_1.adMediaSelect },
    mobileMedia: { select: ads_media_port_1.adMediaSelect },
    targetRegions: { select: { regionCode: true }, orderBy: { regionCode: 'asc' } },
    targetComplexes: {
        select: { complex: { select: { id: true, name: true } } },
        orderBy: { complexId: 'asc' },
    },
};
exports.publicBannerSelect = {
    id: true,
    slot: true,
    title: true,
    advertiserName: true,
    linkUrl: true,
    newWindow: true,
    priority: true,
    sortOrder: true,
    endAt: true,
    agency: { select: { id: true, name: true, status: true, deletedAt: true } },
    pcMedia: { select: ads_media_port_1.adMediaSelect },
    // Optional image: the row is served without it when it was removed (pc image is filtered in SQL).
    mobileMedia: { select: { ...ads_media_port_1.adMediaSelect, status: true, deletedAt: true } },
};
exports.adminPopupSelect = {
    id: true,
    title: true,
    linkUrl: true,
    newWindow: true,
    targetPages: true,
    startAt: true,
    endAt: true,
    paused: true,
    dismissDays: true,
    sortOrder: true,
    createdByAdminId: true,
    createdAt: true,
    updatedAt: true,
    media: { select: ads_media_port_1.adMediaSelect },
};
exports.publicPopupSelect = {
    id: true,
    title: true,
    linkUrl: true,
    newWindow: true,
    dismissDays: true,
    endAt: true,
    media: { select: ads_media_port_1.adMediaSelect },
};
/** DB rows → API views (explicit field picking; memo/admin ids never reach public views). */
let AdsMapper = class AdsMapper {
    constructor(media, config) {
        this.media = media;
        this.apiBase = config.get('API_BASE_URL').replace(/\/+$/, '');
    }
    clickUrl(bannerId) {
        return `${this.apiBase}/api/v1/banners/${bannerId}/click`;
    }
    adminBanner(b, now = new Date()) {
        return {
            id: b.id,
            slot: b.slot,
            title: b.title,
            advertiserName: b.advertiserName,
            agency: b.agency ? { id: b.agency.id, name: b.agency.name } : null,
            pcImage: this.media.view(b.pcMedia),
            mobileImage: b.mobileMedia ? this.media.view(b.mobileMedia) : null,
            linkUrl: b.linkUrl,
            newWindow: b.newWindow,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
            paused: b.paused,
            status: (0, shared_1.computeScheduleStatus)(b, now),
            priority: b.priority,
            sortOrder: b.sortOrder,
            targeting: b.targeting,
            targetRegionCodes: b.targetRegions.map((r) => r.regionCode),
            targetComplexes: b.targetComplexes.map((t) => ({ id: t.complex.id, name: t.complex.name })),
            memo: b.memo,
            createdByAdminId: b.createdByAdminId,
            createdAt: b.createdAt.toISOString(),
            updatedAt: b.updatedAt.toISOString(),
        };
    }
    publicBanner(b) {
        const agency = b.agency && b.agency.status === shared_1.AgencyStatus.APPROVED && !b.agency.deletedAt
            ? { id: b.agency.id, name: b.agency.name }
            : null;
        return {
            id: b.id,
            slot: b.slot,
            title: b.title,
            advertiserName: b.advertiserName,
            agency,
            imageUrl: this.media.url(b.pcMedia),
            mobileImageUrl: b.mobileMedia && !b.mobileMedia.deletedAt && b.mobileMedia.status === shared_1.MediaStatus.READY
                ? this.media.url(b.mobileMedia)
                : null,
            clickUrl: b.linkUrl ? this.clickUrl(b.id) : null,
            newWindow: b.newWindow,
        };
    }
    adminPopup(p, now = new Date()) {
        return {
            id: p.id,
            title: p.title,
            image: this.media.view(p.media),
            linkUrl: p.linkUrl,
            newWindow: p.newWindow,
            targetPages: p.targetPages,
            startAt: p.startAt.toISOString(),
            endAt: p.endAt.toISOString(),
            paused: p.paused,
            status: (0, shared_1.computeScheduleStatus)(p, now),
            dismissDays: p.dismissDays,
            sortOrder: p.sortOrder,
            createdByAdminId: p.createdByAdminId,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
        };
    }
    publicPopup(p) {
        return {
            id: p.id,
            title: p.title,
            imageUrl: this.media.url(p.media),
            linkUrl: p.linkUrl,
            newWindow: p.newWindow,
            dismissDays: p.dismissDays,
            endAt: p.endAt.toISOString(),
        };
    }
};
exports.AdsMapper = AdsMapper;
exports.AdsMapper = AdsMapper = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(ads_media_port_1.ADS_MEDIA)),
    __metadata("design:paramtypes", [Object, app_config_service_1.AppConfig])
], AdsMapper);
//# sourceMappingURL=ads.mapper.js.map