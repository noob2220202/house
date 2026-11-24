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
exports.MediaFiles = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const media_storage_1 = require("./media-storage");
const VARIANT_NAMES = Object.keys(shared_1.IMAGE_VARIANTS);
/** File layout of a media row: the full-size image + its variants, a private file, staging. */
let MediaFiles = class MediaFiles {
    constructor(storage) {
        this.storage = storage;
    }
    /** Writes the full-size image and its variants; returns the `variants` column value. */
    async writeImage(key, processed) {
        const variants = {};
        const writes = [this.storage.write(shared_1.MediaVisibility.PUBLIC, key, processed.original.data)];
        for (const name of VARIANT_NAMES) {
            const v = processed.variants[name];
            const vKey = this.storage.variantKey(key, name);
            variants[name] = { key: vKey, width: v.width, height: v.height };
            writes.push(this.storage.write(shared_1.MediaVisibility.PUBLIC, vKey, v.data));
        }
        const results = await Promise.allSettled(writes);
        const failed = results.find((r) => r.status === 'rejected');
        if (failed) {
            await this.removeImage(key);
            throw failed.reason;
        }
        return variants;
    }
    removeImage(key) {
        return this.storage.remove(shared_1.MediaVisibility.PUBLIC, this.imageKeys(key));
    }
    /** Idempotent: missing files are ignored. */
    async removeAll(row) {
        const keys = row.visibility === shared_1.MediaVisibility.PUBLIC ? this.imageKeys(row.storageKey) : [row.storageKey];
        await Promise.all([
            this.storage.remove(row.visibility, keys),
            this.storage.removeStaging(row.id),
        ]);
    }
    imageKeys(key) {
        return [key, ...VARIANT_NAMES.map((v) => this.storage.variantKey(key, v))];
    }
};
exports.MediaFiles = MediaFiles;
exports.MediaFiles = MediaFiles = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_storage_1.MediaStorage])
], MediaFiles);
//# sourceMappingURL=media-files.js.map