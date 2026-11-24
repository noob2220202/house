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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaStorage = void 0;
exports.assertDisjointRoots = assertDisjointRoots;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../config/app-config.service");
const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/;
const UUID_PATTERN = /^[0-9a-f-]{36}$/;
/**
 * Local-disk storage. Keys are random and generated here only (no user-controlled path parts).
 *  - PUBLIC  → UPLOAD_DIR          (nginx serves it at MEDIA_BASE_URL, e.g. /media/*)
 *  - PRIVATE → PRIVATE_UPLOAD_DIR  (never served by nginx; authorized streaming only)
 * Raw uploads waiting for the worker sit in PRIVATE_UPLOAD_DIR/staging — they still carry EXIF
 * (GPS!) so they must never be under the public root.
 */
let MediaStorage = class MediaStorage {
    constructor(config) {
        this.roots = {
            PUBLIC: node_path_1.default.resolve(config.get('UPLOAD_DIR')),
            PRIVATE: node_path_1.default.resolve(config.get('PRIVATE_UPLOAD_DIR')),
        };
        assertDisjointRoots(this.roots.PUBLIC, this.roots.PRIVATE);
        this.baseUrl = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
    }
    /** `img/2026/11/ab/<32 hex>.webp` — the sanitized full-size image; variants sit next to it. */
    newPublicImageKey(now = new Date()) {
        const rand = (0, node_crypto_1.randomBytes)(16).toString('hex');
        return `img/${monthPath(now)}/${rand.slice(0, 2)}/${rand}.webp`;
    }
    /** `doc/2026/11/<32 hex>.<ext>` under the private root. */
    newPrivateKey(ext, now = new Date()) {
        if (!/^[a-z0-9]{2,5}$/.test(ext))
            throw new Error(`invalid extension "${ext}"`);
        return `doc/${monthPath(now)}/${(0, node_crypto_1.randomBytes)(16).toString('hex')}.${ext}`;
    }
    variantKey(originalKey, variant) {
        return originalKey.replace(/\.webp$/, `_${variant}.webp`);
    }
    publicUrl(key) {
        return `${this.baseUrl}/${key}`;
    }
    /** Absolute path of a key, or null if it would escape its root (defense in depth). */
    resolve(visibility, key) {
        if (!KEY_PATTERN.test(key) || key.includes('..'))
            return null;
        const root = this.roots[visibility];
        const resolved = node_path_1.default.resolve(root, key);
        return resolved.startsWith(root + node_path_1.default.sep) ? resolved : null;
    }
    async write(visibility, key, data) {
        const target = this.mustResolve(visibility, key);
        const isPrivate = visibility === shared_1.MediaVisibility.PRIVATE;
        await (0, promises_1.mkdir)(node_path_1.default.dirname(target), { recursive: true, mode: isPrivate ? 0o700 : 0o755 });
        // Write-then-rename so nginx never serves a half-written file.
        const tmp = `${target}.tmp-${(0, node_crypto_1.randomBytes)(6).toString('hex')}`;
        try {
            await (0, promises_1.writeFile)(tmp, data, { mode: isPrivate ? 0o600 : 0o644, flag: 'wx' });
            await (0, promises_1.rename)(tmp, target);
        }
        catch (err) {
            await (0, promises_1.rm)(tmp, { force: true });
            throw err;
        }
    }
    /** Removes keys; missing files are fine (idempotent). */
    async remove(visibility, keys) {
        await Promise.all(keys.map(async (key) => {
            const target = this.resolve(visibility, key);
            if (target)
                await (0, promises_1.rm)(target, { force: true });
        }));
    }
    async size(visibility, key) {
        const target = this.resolve(visibility, key);
        if (!target)
            return null;
        const info = await (0, promises_1.stat)(target).catch(() => null);
        return info?.isFile() ? info.size : null;
    }
    open(visibility, key) {
        return (0, node_fs_1.createReadStream)(this.mustResolve(visibility, key));
    }
    stagingKey(mediaId) {
        if (!UUID_PATTERN.test(mediaId))
            throw new Error('invalid media id');
        return `staging/${mediaId}`;
    }
    writeStaging(mediaId, data) {
        return this.write(shared_1.MediaVisibility.PRIVATE, this.stagingKey(mediaId), data);
    }
    async readStaging(mediaId) {
        const target = this.mustResolve(shared_1.MediaVisibility.PRIVATE, this.stagingKey(mediaId));
        return (0, promises_1.readFile)(target).catch((err) => {
            if (err.code === 'ENOENT')
                return null;
            throw err;
        });
    }
    removeStaging(mediaId) {
        return this.remove(shared_1.MediaVisibility.PRIVATE, [this.stagingKey(mediaId)]);
    }
    mustResolve(visibility, key) {
        const resolved = this.resolve(visibility, key);
        if (!resolved)
            throw new Error(`invalid storage key "${key}"`);
        return resolved;
    }
};
exports.MediaStorage = MediaStorage;
exports.MediaStorage = MediaStorage = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], MediaStorage);
/**
 * Refuses to start when one root contains the other: nginx would then serve private documents
 * (or raw staging uploads with EXIF/GPS) under /media, or private paths would shadow public ones.
 */
function assertDisjointRoots(publicRoot, privateRoot) {
    const pub = node_path_1.default.resolve(publicRoot) + node_path_1.default.sep;
    const priv = node_path_1.default.resolve(privateRoot) + node_path_1.default.sep;
    if (pub.startsWith(priv) || priv.startsWith(pub)) {
        throw new Error(`UPLOAD_DIR (${publicRoot}) and PRIVATE_UPLOAD_DIR (${privateRoot}) must not contain each other`);
    }
}
function monthPath(now) {
    return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
//# sourceMappingURL=media-storage.js.map