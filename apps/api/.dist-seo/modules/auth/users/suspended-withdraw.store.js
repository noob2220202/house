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
exports.SuspendedWithdrawStore = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../../redis/redis.constants");
const auth_constants_1 = require("../auth.constants");
const oauth_state_store_1 = require("../oauth/oauth-state.store");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/**
 * A suspended member gets no session, but must still be able to withdraw (개인정보 보호법 제36·37조).
 * When their social login is refused for suspension, the OAuth callback parks a short-lived ticket
 * here (httpOnly cookie scoped to POST /auth/withdraw). The ticket proves a fresh login with the
 * account's own social identity and is good for nothing but that withdrawal.
 */
let SuspendedWithdrawStore = class SuspendedWithdrawStore {
    constructor(redis) {
        this.redis = redis;
    }
    async create(userId) {
        const token = (0, oauth_state_store_1.randomToken)();
        await this.redis.set(auth_constants_1.REDIS_KEYS.suspendedWithdraw((0, oauth_state_store_1.sha256Hex)(token)), userId, 'EX', auth_constants_1.SUSPENDED_WITHDRAW_TTL_SECONDS);
        return token;
    }
    async get(token) {
        if (!token || !TOKEN_PATTERN.test(token))
            return null;
        return this.redis.get(auth_constants_1.REDIS_KEYS.suspendedWithdraw((0, oauth_state_store_1.sha256Hex)(token)));
    }
    async delete(token) {
        if (!TOKEN_PATTERN.test(token))
            return;
        await this.redis.del(auth_constants_1.REDIS_KEYS.suspendedWithdraw((0, oauth_state_store_1.sha256Hex)(token)));
    }
};
exports.SuspendedWithdrawStore = SuspendedWithdrawStore;
exports.SuspendedWithdrawStore = SuspendedWithdrawStore = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [Function])
], SuspendedWithdrawStore);
//# sourceMappingURL=suspended-withdraw.store.js.map