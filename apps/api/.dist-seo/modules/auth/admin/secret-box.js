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
exports.SecretBox = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const VERSION = 'v1';
/**
 * AES-256-GCM for small secrets at rest (admin TOTP secrets), keyed by TOTP_ENCRYPTION_KEY.
 * `aad` binds a ciphertext to its owner (the admin id), so a secret copied onto another row fails.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
let SecretBox = class SecretBox {
    constructor(config) {
        this.key = Buffer.from(config.get('TOTP_ENCRYPTION_KEY'), 'base64');
        if (this.key.length !== 32)
            throw new Error('TOTP_ENCRYPTION_KEY must decode to 32 bytes');
    }
    encrypt(plaintext, aad) {
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', this.key, iv);
        cipher.setAAD(Buffer.from(aad));
        const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return [VERSION, iv, tag, ct]
            .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
            .join('.');
    }
    /** Throws when the payload was tampered with, belongs to another aad, or uses another key. */
    decrypt(payload, aad) {
        const [version, iv, tag, ct] = payload.split('.');
        if (version !== VERSION || !iv || !tag || ct === undefined) {
            throw new Error('Unsupported secret payload');
        }
        const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
        decipher.setAAD(Buffer.from(aad));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([
            decipher.update(Buffer.from(ct, 'base64url')),
            decipher.final(),
        ]).toString('utf8');
    }
};
exports.SecretBox = SecretBox;
exports.SecretBox = SecretBox = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], SecretBox);
//# sourceMappingURL=secret-box.js.map