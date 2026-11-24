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
exports.WithdrawnIdentityService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_constants_1 = require("../auth.constants");
/**
 * 탈퇴 후 재가입 제한: remembers the social accounts of withdrawn members for REJOIN_COOLDOWN_DAYS,
 * so "withdraw, then sign up again" cannot shed daily caps, reports or moderation history.
 * Provider ids are stored as HMAC-SHA256 (keyed by COOKIE_SECRET): provider ids are short and
 * guessable, a plain hash would not pseudonymize them. Rotating COOKIE_SECRET ends running
 * cooldowns early (acceptable: it only weakens an abuse control for at most 30 days).
 */
let WithdrawnIdentityService = class WithdrawnIdentityService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.key = config.get('COOKIE_SECRET');
    }
    hash(account) {
        return (0, node_crypto_1.createHmac)('sha256', this.key)
            .update(`withdrawn-identity:v1:${account.provider}:${account.providerUserId}`)
            .digest('hex');
    }
    /** Writes (or refreshes) a tombstone per identity, inside the withdrawal transaction. */
    async record(tx, userId, accounts, now, opts = {}) {
        const days = opts.cooldownDays ?? auth_constants_1.REJOIN_COOLDOWN_DAYS;
        const rejoinAfter = new Date(now.getTime() + days * 86_400_000);
        for (const account of accounts) {
            const providerUserIdHash = this.hash(account);
            await tx.withdrawnIdentity.upsert({
                where: {
                    provider_providerUserIdHash: { provider: account.provider, providerUserIdHash },
                },
                create: {
                    provider: account.provider,
                    providerUserIdHash,
                    userId,
                    withdrawnAt: now,
                    rejoinAfter,
                },
                update: { userId, withdrawnAt: now, rejoinAfter },
            });
        }
    }
    /** True while this social account may not sign up again. */
    async inCooldown(account, now = new Date(), db = this.prisma) {
        const row = await db.withdrawnIdentity.findUnique({
            where: {
                provider_providerUserIdHash: {
                    provider: account.provider,
                    providerUserIdHash: this.hash(account),
                },
            },
            select: { rejoinAfter: true },
        });
        return row !== null && row.rejoinAfter > now;
    }
    /** Deletes tombstones whose cooldown is over (PII scrub job). */
    async purgeExpired(now = new Date()) {
        const { count } = await this.prisma.withdrawnIdentity.deleteMany({
            where: { rejoinAfter: { lte: now } },
        });
        return count;
    }
};
exports.WithdrawnIdentityService = WithdrawnIdentityService;
exports.WithdrawnIdentityService = WithdrawnIdentityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfig])
], WithdrawnIdentityService);
//# sourceMappingURL=withdrawn-identity.service.js.map