"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = void 0;
exports.normalizeRecoveryCode = normalizeRecoveryCode;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const argon2_1 = require("@node-rs/argon2");
/** OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1). The library default is argon2id. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 };
/** No 0/O/1/I/L/U: unambiguous when read off a screen or paper. */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
/**
 * argon2id password hashing for admin accounts (exported: the admin module uses it to create
 * admins) and one-time recovery codes.
 */
let PasswordService = class PasswordService {
    constructor() {
        /** Real hash of a random value: verified against when the email is unknown (equal timing). */
        this.dummyHash = '';
    }
    async onModuleInit() {
        this.dummyHash = await this.hash((0, node_crypto_1.randomBytes)(16).toString('hex'));
    }
    hash(password) {
        return (0, argon2_1.hash)(password, ARGON2_OPTIONS);
    }
    async verify(passwordHash, password) {
        try {
            return await (0, argon2_1.verify)(passwordHash, password);
        }
        catch {
            return false;
        }
    }
    /** Burns the same time as a real verification (unknown account). Always false. */
    async verifyDummy(password) {
        if (this.dummyHash)
            await this.verify(this.dummyHash, password);
        return false;
    }
    /** Recovery codes in display form "ABCD-EFGH". Store only their hashes (normalizeRecoveryCode first). */
    generateRecoveryCodes(count) {
        return Array.from({ length: count }, () => {
            const chars = Array.from({ length: 8 }, () => RECOVERY_ALPHABET[(0, node_crypto_1.randomInt)(RECOVERY_ALPHABET.length)]).join('');
            return `${chars.slice(0, 4)}-${chars.slice(4)}`;
        });
    }
};
exports.PasswordService = PasswordService;
exports.PasswordService = PasswordService = __decorate([
    (0, common_1.Injectable)()
], PasswordService);
/** "abcd-efgh" → "ABCDEFGH" (matches recoveryCodeSchema's transform). */
function normalizeRecoveryCode(code) {
    return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}
//# sourceMappingURL=password.service.js.map