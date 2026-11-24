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
exports.NaverOAuthProvider = exports.NAVER_ENDPOINTS = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const app_config_service_1 = require("../../../../config/app-config.service");
const oauth_http_1 = require("../oauth-http");
const oauth_provider_1 = require("../oauth-provider");
const redirect_uri_1 = require("./redirect-uri");
exports.NAVER_ENDPOINTS = {
    authorize: 'https://nid.naver.com/oauth2.0/authorize',
    token: 'https://nid.naver.com/oauth2.0/token',
    me: 'https://openapi.naver.com/v1/nid/me',
};
// Naver answers token errors with HTTP 200 + { error, error_description }.
const tokenSchema = zod_1.z.union([
    zod_1.z.object({ access_token: zod_1.z.string().min(1), token_type: zod_1.z.string().optional() }),
    zod_1.z.object({ error: zod_1.z.string(), error_description: zod_1.z.string().optional() }),
]);
const meSchema = zod_1.z.object({
    resultcode: zod_1.z.string(),
    message: zod_1.z.string().optional(),
    response: zod_1.z
        .object({
        id: zod_1.z.string().min(1),
        nickname: zod_1.z.string().nullish(),
        name: zod_1.z.string().nullish(),
        email: zod_1.z.string().nullish(),
        mobile: zod_1.z.string().nullish(),
        mobile_e164: zod_1.z.string().nullish(),
        profile_image: zod_1.z.string().nullish(),
    })
        .optional(),
});
/** 네이버 로그인. Profile fields (이름, 이메일, 휴대전화번호…) are chosen in the Naver developer console. */
let NaverOAuthProvider = class NaverOAuthProvider {
    constructor(config, http) {
        this.config = config;
        this.http = http;
        this.provider = shared_1.AuthProvider.NAVER;
    }
    isEnabled() {
        return Boolean(this.config.get('NAVER_CLIENT_ID') && this.config.get('NAVER_CLIENT_SECRET'));
    }
    redirectUri() {
        return this.config.get('NAVER_REDIRECT_URI') ?? (0, redirect_uri_1.defaultRedirectUri)(this.config, 'naver');
    }
    buildAuthorizeUrl(p) {
        const url = new URL(exports.NAVER_ENDPOINTS.authorize);
        url.search = new URLSearchParams({
            response_type: 'code',
            client_id: this.credentials().clientId,
            redirect_uri: p.redirectUri,
            state: p.state,
        }).toString();
        return url.toString();
    }
    async exchangeCode(p) {
        const { clientId, clientSecret } = this.credentials();
        const res = await this.http.request({
            method: 'POST',
            url: exports.NAVER_ENDPOINTS.token,
            form: {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code: p.code,
                state: p.state,
            },
        });
        const body = (0, oauth_provider_1.parseProviderBody)(this.provider, 'token exchange', res, tokenSchema);
        if ('error' in body) {
            throw new oauth_provider_1.OAuthProviderError(this.provider, `token exchange rejected: ${body.error}`);
        }
        return { accessToken: body.access_token };
    }
    async fetchProfile(tokens) {
        const res = await this.http.request({
            method: 'GET',
            url: exports.NAVER_ENDPOINTS.me,
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        const me = (0, oauth_provider_1.parseProviderBody)(this.provider, 'profile', res, meSchema);
        if (me.resultcode !== '00' || !me.response) {
            throw new oauth_provider_1.OAuthProviderError(this.provider, `profile resultcode ${me.resultcode}`);
        }
        const r = me.response;
        return {
            provider: this.provider,
            providerUserId: r.id,
            email: (0, oauth_provider_1.cleanEmail)(r.email),
            // Naver's email is a contact address chosen by the user, not a verified login email.
            emailVerified: false,
            name: (0, oauth_provider_1.cleanText)(r.name, 50),
            nickname: (0, oauth_provider_1.cleanText)(r.nickname, 30),
            phone: (0, oauth_provider_1.normalizeProviderPhone)(r.mobile_e164 ?? r.mobile),
            profileImageUrl: (0, oauth_provider_1.cleanImageUrl)(r.profile_image),
        };
    }
    credentials() {
        const clientId = this.config.get('NAVER_CLIENT_ID');
        const clientSecret = this.config.get('NAVER_CLIENT_SECRET');
        if (!clientId || !clientSecret)
            throw new oauth_provider_1.OAuthProviderError(this.provider, 'not configured');
        return { clientId, clientSecret };
    }
};
exports.NaverOAuthProvider = NaverOAuthProvider;
exports.NaverOAuthProvider = NaverOAuthProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(oauth_http_1.OAUTH_HTTP)),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig, Object])
], NaverOAuthProvider);
//# sourceMappingURL=naver.provider.js.map