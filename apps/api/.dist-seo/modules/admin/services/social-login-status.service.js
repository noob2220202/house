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
exports.SocialLoginStatusService = void 0;
exports.maskClientId = maskClientId;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const DAY_MS = 86_400_000;
/** 카카오 · 네이버 · Google only (no Apple). Same "configured" rule as the auth module's providers. */
const PROVIDERS = [
    {
        provider: shared_1.AuthProvider.KAKAO,
        slug: 'kakao',
        id: 'KAKAO_CLIENT_ID',
        secret: 'KAKAO_CLIENT_SECRET',
        redirect: 'KAKAO_REDIRECT_URI',
        secretRequired: false,
    },
    {
        provider: shared_1.AuthProvider.NAVER,
        slug: 'naver',
        id: 'NAVER_CLIENT_ID',
        secret: 'NAVER_CLIENT_SECRET',
        redirect: 'NAVER_REDIRECT_URI',
        secretRequired: true,
    },
    {
        provider: shared_1.AuthProvider.GOOGLE,
        slug: 'google',
        id: 'GOOGLE_CLIENT_ID',
        secret: 'GOOGLE_CLIENT_SECRET',
        redirect: 'GOOGLE_REDIRECT_URI',
        secretRequired: true,
    },
];
/**
 * "7f3c1234567890a91e" → "7f3c••••••••••a91e"; a Google id keeps its public suffix
 * (".apps.googleusercontent.com"). Short ids are fully masked.
 */
function maskClientId(clientId) {
    if (!clientId)
        return null;
    const suffix = clientId.endsWith('.apps.googleusercontent.com')
        ? '.apps.googleusercontent.com'
        : '';
    const core = suffix ? clientId.slice(0, -suffix.length) : clientId;
    if (core.length <= 8)
        return `${'•'.repeat(Math.max(4, core.length))}${suffix}`;
    const tail = suffix ? '' : core.slice(-4);
    return `${core.slice(0, 4)}${'•'.repeat(core.length - 4 - tail.length)}${tail}${suffix}`;
}
/**
 * GET /admin/social-login — read-only status of the OAuth providers. Configuration comes from the
 * API environment (client secrets are never returned, client ids only masked); activity from the
 * identities table: `lastSuccessAt` / `last24h.success` count sign-ins (Identity.lastUsedAt) and
 * `userShare` the share of non-withdrawn members linked to the provider. Failed callbacks are not
 * recorded, so `last24h.failure` is 0 and `healthy` means "configured".
 */
let SocialLoginStatusService = class SocialLoginStatusService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async status(now = new Date()) {
        const since = new Date(now.getTime() - DAY_MS);
        const live = { status: { not: shared_1.UserStatus.WITHDRAWN } };
        const [members, linked, lastUsed, recent] = await Promise.all([
            this.prisma.user.count({ where: live }),
            this.prisma.identity.groupBy({
                by: ['provider'],
                where: { user: live },
                _count: { _all: true },
            }),
            this.prisma.identity.groupBy({ by: ['provider'], _max: { lastUsedAt: true } }),
            this.prisma.identity.groupBy({
                by: ['provider'],
                where: { lastUsedAt: { gte: since } },
                _count: { _all: true },
            }),
        ]);
        const linkedBy = new Map(linked.map((g) => [g.provider, g._count._all]));
        const lastBy = new Map(lastUsed.map((g) => [g.provider, g._max.lastUsedAt]));
        const recentBy = new Map(recent.map((g) => [g.provider, g._count._all]));
        const base = this.config.get('API_BASE_URL').replace(/\/+$/, '');
        const items = PROVIDERS.map((p) => {
            const clientId = this.config.get(p.id);
            const enabled = Boolean(clientId && (!p.secretRequired || this.config.get(p.secret)));
            const last = lastBy.get(p.provider) ?? null;
            return {
                provider: p.provider,
                enabled,
                healthy: enabled,
                clientIdMasked: maskClientId(clientId),
                callbackUrl: this.config.get(p.redirect) ?? `${base}/${shared_1.API_PREFIX}/auth/oauth/${p.slug}/callback`,
                lastSuccessAt: last ? last.toISOString() : null,
                last24h: { success: recentBy.get(p.provider) ?? 0, failure: 0 },
                userShare: members > 0
                    ? Math.min(1, Math.round(((linkedBy.get(p.provider) ?? 0) / members) * 1000) / 1000)
                    : null,
                message: enabled
                    ? null
                    : clientId
                        ? '클라이언트 시크릿이 설정되지 않아 로그인 버튼이 표시되지 않습니다.'
                        : '클라이언트 ID가 설정되지 않아 로그인 버튼이 표시되지 않습니다.',
            };
        });
        return { items };
    }
};
exports.SocialLoginStatusService = SocialLoginStatusService;
exports.SocialLoginStatusService = SocialLoginStatusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfig])
], SocialLoginStatusService);
//# sourceMappingURL=social-login-status.service.js.map