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
exports.OAuthStateStore = void 0;
exports.randomToken = randomToken;
exports.sha256Hex = sha256Hex;
exports.pkceChallenge = pkceChallenge;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../../redis/redis.constants");
const auth_constants_1 = require("../auth.constants");
function randomToken(bytes = 32) {
    return (0, node_crypto_1.randomBytes)(bytes).toString('base64url');
}
function sha256Hex(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
}
/** RFC 7636 S256 code challenge. */
function pkceChallenge(verifier) {
    return (0, node_crypto_1.createHash)('sha256').update(verifier).digest('base64url');
}
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** OAuth `state` records in Redis: short TTL, single use (GETDEL). */
let OAuthStateStore = class OAuthStateStore {
    constructor(redis) {
        this.redis = redis;
    }
    async create(input) {
        const state = randomToken();
        const record = { ...input, createdAt: Date.now() };
        await this.redis.set(auth_constants_1.REDIS_KEYS.oauthState(state), JSON.stringify(record), 'EX', auth_constants_1.OAUTH_STATE_TTL_SECONDS);
        return state;
    }
    /** Returns and deletes the record (a state can be redeemed once). */
    async consume(state) {
        if (!STATE_PATTERN.test(state))
            return null;
        const raw = await this.redis.getdel(auth_constants_1.REDIS_KEYS.oauthState(state));
        return raw ? JSON.parse(raw) : null;
    }
};
exports.OAuthStateStore = OAuthStateStore;
exports.OAuthStateStore = OAuthStateStore = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [Function])
], OAuthStateStore);
//# sourceMappingURL=oauth-state.store.js.map