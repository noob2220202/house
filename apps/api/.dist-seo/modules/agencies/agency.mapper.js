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
exports.AgencyMapper = void 0;
exports.maskName = maskName;
exports.toBusinessHours = toBusinessHours;
exports.toDocumentView = toDocumentView;
exports.toMemberView = toMemberView;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const agency_media_port_1 = require("./ports/agency-media.port");
const iso = (d) => (d ? d.toISOString() : null);
/** 홍길동 → 홍*동, 김철 → 김*: admin lists show who applied without the full name. */
function maskName(name) {
    if (!name)
        return null;
    const chars = [...name.trim()];
    if (chars.length <= 1)
        return '*';
    if (chars.length === 2)
        return `${chars[0]}*`;
    return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}
function toBusinessHours(value) {
    if (value === null)
        return null;
    const parsed = shared_1.businessHoursSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}
function toDocumentView(d) {
    return {
        id: d.id,
        type: d.type,
        mediaId: d.mediaId,
        mimeType: d.media.mimeType,
        sizeBytes: d.media.sizeBytes,
        originalFilename: d.media.originalFilename,
        createdAt: d.createdAt.toISOString(),
    };
}
function toMemberView(m) {
    return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        displayName: m.displayName,
        title: m.title,
        phone: m.phone,
        isLicensed: m.isLicensed,
        licenseNumber: m.licenseNumber,
        joinedAt: m.joinedAt.toISOString(),
        removedAt: iso(m.removedAt),
    };
}
/** DB rows → API shapes. Explicit field picking: documents' storage keys never leave the API. */
let AgencyMapper = class AgencyMapper {
    constructor(media) {
        this.media = media;
    }
    logoUrl(logo) {
        return logo && !logo.deletedAt ? this.media.publicUrl(logo, 'thumb') : null;
    }
    /** Cover (header) image: the wide `large` variant. */
    coverUrl(cover) {
        return cover && !cover.deletedAt ? this.media.publicUrl(cover, 'large') : null;
    }
    summary(a) {
        return {
            id: a.id,
            name: a.name,
            representativeName: a.representativeName,
            registrationNumber: a.registrationNumber,
            phone: a.phone,
            roadAddress: a.roadAddress,
            addressDetail: a.addressDetail,
            emdCode: a.emdCode,
            lat: a.lat,
            lng: a.lng,
            specialties: a.specialties,
            logoUrl: this.logoUrl(a.logo),
            activeListingCount: a.activeListingCount,
        };
    }
    mine(a) {
        const history = a.statusHistory.map((h) => ({
            id: h.id,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            reason: h.reason,
            decidedBy: h.decidedBy ? { id: h.decidedBy.id, name: h.decidedBy.name } : null,
            createdAt: h.createdAt.toISOString(),
        }));
        return {
            ...this.summary(a),
            businessNumber: a.businessNumber,
            mobile: a.mobile,
            email: a.email,
            jibunAddress: a.jibunAddress,
            zipCode: a.zipCode,
            intro: a.intro,
            businessHours: toBusinessHours(a.businessHours),
            logoMediaId: a.logoMediaId,
            coverMediaId: a.coverMediaId,
            coverUrl: this.coverUrl(a.cover),
            status: a.status,
            statusReason: a.statusReason,
            approvedAt: iso(a.approvedAt),
            suspendedAt: iso(a.suspendedAt),
            memberCount: a._count.members,
            documents: a.documents.map(toDocumentView),
            statusHistory: history,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
        };
    }
};
exports.AgencyMapper = AgencyMapper;
exports.AgencyMapper = AgencyMapper = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(agency_media_port_1.AGENCY_MEDIA)),
    __metadata("design:paramtypes", [Object])
], AgencyMapper);
//# sourceMappingURL=agency.mapper.js.map