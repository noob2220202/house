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
exports.KakaoOAuthProvider = exports.KAKAO_ENDPOINTS = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const app_config_service_1 = require("../../../../config/app-config.service");
const oauth_http_1 = require("../oauth-http");
const oauth_provider_1 = require("../oauth-provider");
const redirect_uri_1 = require("./redirect-uri");
exports.KAKAO_ENDPOINTS = {
    authorize: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    me: 'https://kapi.kakao.com/v2/user/me',
};
const tokenSchema = zod_1.z.object({ access_token: zod_1.z.string().min(1), token_type: zod_1.z.string() });
const meSchema = zod_1.z.object({
    id: zod_1.z.union([zod_1.z.number().int(), zod_1.z.string().regex(/^\d+$/)]),
    kakao_account: zod_1.z
        .object({
        profile: zod_1.z
            .object({
            nickname: zod_1.z.string().nullish(),
            profile_image_url: zod_1.z.string().nullish(),
            is_default_image: zod_1.z.boolean().nullish(),
        })
            .nullish(),
        name: zod_1.z.string().nullish(),
        email: zod_1.z.string().nullish(),
        is_email_valid: zod_1.z.boolean().nullish(),
        is_email_verified: zod_1.z.boolean().nullish(),
        phone_number: zod_1.z.string().nullish(),
    })
        .nullish(),
});
/** 카카오 로그인 (REST API). Scopes (nickname, email, phone_number…) are set in the Kakao console. */
let KakaoOAuthProvider = class KakaoOAuthProvider {
    constructor(config, http) {
        this.config = config;
        this.http = http;
        this.provider = shared_1.AuthProvider.KAKAO;
    }
    isEnabled() {
        return Boolean(this.config.get('KAKAO_CLIENT_ID'));
    }
    redirectUri() {
        return this.config.get('KAKAO_REDIRECT_URI') ?? (0, redirect_uri_1.defaultRedirectUri)(this.config, 'kakao');
    }
    buildAuthorizeUrl(p) {
        const url = new URL(exports.KAKAO_ENDPOINTS.authorize);
        url.search = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId(),
            redirect_uri: p.redirectUri,
            state: p.state,
        }).toString();
        return url.toString();
    }
    async exchangeCode(p) {
        const form = {
            grant_type: 'authorization_code',
            client_id: this.clientId(),
            redirect_uri: p.redirectUri,
            code: p.code,
        };
        const secret = this.config.get('KAKAO_CLIENT_SECRET');
        if (secret)
            form.client_secret = secret;
        const res = await this.http.request({ method: 'POST', url: exports.KAKAO_ENDPOINTS.token, form });
        const body = (0, oauth_provider_1.parseProviderBody)(this.provider, 'token exchange', res, tokenSchema);
        return { accessToken: body.access_token };
    }
    async fetchProfile(tokens) {
        const res = await this.http.request({
            method: 'GET',
            url: exports.KAKAO_ENDPOINTS.me,
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        const me = (0, oauth_provider_1.parseProviderBody)(this.provider, 'profile', res, meSchema);
        const account = me.kakao_account ?? {};
        const email = account.is_email_valid === false ? null : (0, oauth_provider_1.cleanEmail)(account.email);
        return {
            provider: this.provider,
            providerUserId: String(me.id),
            email,
            emailVerified: email !== null && account.is_email_verified === true,
            name: (0, oauth_provider_1.cleanText)(account.name, 50),
            nickname: (0, oauth_provider_1.cleanText)(account.profile?.nickname, 30),
            phone: (0, oauth_provider_1.normalizeProviderPhone)(account.phone_number),
            profileImageUrl: account.profile?.is_default_image
                ? null
                : (0, oauth_provider_1.cleanImageUrl)(account.profile?.profile_image_url),
        };
    }
    clientId() {
        const id = this.config.get('KAKAO_CLIENT_ID');
        if (!id)
            throw new oauth_provider_1.OAuthProviderError(this.provider, 'not configured');
        return id;
    }
};
exports.KakaoOAuthProvider = KakaoOAuthProvider;
exports.KakaoOAuthProvider = KakaoOAuthProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(oauth_http_1.OAUTH_HTTP)),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig, Object])
], KakaoOAuthProvider);
//# sourceMappingURL=kakao.provider.js.map