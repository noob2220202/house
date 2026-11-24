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
exports.MediaMapper = void 0;
exports.parseVariants = parseVariants;
exports.referenceTotal = referenceTotal;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const media_storage_1 = require("./media-storage");
const media_selects_1 = require("./media.selects");
const storedVariantSchema = zod_1.z.object({
    key: zod_1.z.string().min(1),
    width: zod_1.z.number().int().positive(),
    height: zod_1.z.number().int().positive(),
});
const VARIANT_NAMES = Object.keys(shared_1.IMAGE_VARIANTS);
/** Key of one variant; only the key matters for URLs (dimensions are optional here). */
function variantKeyOf(json, name) {
    if (!json || typeof json !== 'object' || Array.isArray(json))
        return null;
    const v = json[name];
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return null;
    return typeof v.key === 'string' && v.key.length > 0 ? v.key : null;
}
/** Reads the `variants` JSON column defensively (unknown/invalid entries are ignored). */
function parseVariants(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json))
        return {};
    const out = {};
    for (const name of VARIANT_NAMES) {
        const parsed = storedVariantSchema.safeParse(json[name]);
        if (parsed.success)
            out[name] = parsed.data;
    }
    return out;
}
/** Media row → response view. Never exposes storage keys, sha256 or file names to non-owners. */
let MediaMapper = class MediaMapper {
    constructor(storage) {
        this.storage = storage;
    }
    /** Public URL of a variant (falls back to the full-size image). */
    url(ref, variant = 'large') {
        const key = variantKeyOf(ref.variants, variant) ?? ref.storageKey;
        return this.storage.publicUrl(key);
    }
    variantUrls(ref) {
        return {
            thumb: this.url(ref, 'thumb'),
            medium: this.url(ref, 'medium'),
            large: this.url(ref, 'large'),
        };
    }
    toView(row) {
        const servable = row.visibility === shared_1.MediaVisibility.PUBLIC && row.status === shared_1.MediaStatus.READY;
        const variants = {};
        if (servable) {
            for (const [name, v] of Object.entries(parseVariants(row.variants))) {
                variants[name] = { url: this.storage.publicUrl(v.key), width: v.width, height: v.height };
            }
        }
        return {
            id: row.id,
            purpose: row.purpose,
            visibility: row.visibility,
            status: row.status,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            width: row.width,
            height: row.height,
            url: servable ? this.storage.publicUrl(row.storageKey) : null,
            variants,
            createdAt: row.createdAt.toISOString(),
        };
    }
    toOwnView(row) {
        return {
            ...this.toView(row),
            originalFilename: row.originalFilename,
            error: row.error,
            attached: referenceTotal(row) > 0,
        };
    }
    toAdminView(row) {
        return {
            ...this.toOwnView(row),
            ownerUserId: row.ownerUserId,
            ownerAdminId: row.ownerAdminId,
            sha256: row.sha256,
            deletedAt: row.deletedAt?.toISOString() ?? null,
            references: { ...row._count },
        };
    }
};
exports.MediaMapper = MediaMapper;
exports.MediaMapper = MediaMapper = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_storage_1.MediaStorage])
], MediaMapper);
function referenceTotal(row) {
    return media_selects_1.MEDIA_REFERENCE_RELATIONS.reduce((sum, r) => sum + row._count[r], 0);
}
//# sourceMappingURL=media.mapper.js.map