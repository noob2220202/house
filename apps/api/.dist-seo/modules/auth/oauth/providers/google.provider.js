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
exports.GoogleOAuthProvider = exports.GOOGLE_ENDPOINTS = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const app_config_service_1 = require("../../../../config/app-config.service");
const google_id_token_verifier_1 = require("../google-id-token.verifier");
const oauth_http_1 = require("../oauth-http");
const oauth_provider_1 = require("../oauth-provider");
const redirect_uri_1 = require("./redirect-uri");
exports.GOOGLE_ENDPOINTS = {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
};
const tokenSchema = zod_1.z.object({
    access_token: zod_1.z.string().min(1),
    id_token: zod_1.z.string().min(1),
    token_type: zod_1.z.string().optional(),
});
/**
 * Google (OIDC): authorization code + PKCE (S256) + nonce. The profile comes from the verified
 * id_token — no userinfo call, so nothing unverified feeds the account.
 */
let GoogleOAuthProvider = class GoogleOAuthProvider {
    constructor(config, http, verifier) {
        this.config = config;
        this.http = http;
        this.verifier = verifier;
        this.provider = shared_1.AuthProvider.GOOGLE;
    }
    isEnabled() {
        return Boolean(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET'));
    }
    redirectUri() {
        return this.config.get('GOOGLE_REDIRECT_URI') ?? (0, redirect_uri_1.defaultRedirectUri)(this.config, 'google');
    }
    buildAuthorizeUrl(p) {
        const url = new URL(exports.GOOGLE_ENDPOINTS.authorize);
        url.search = new URLSearchParams({
            response_type: 'code',
            client_id: this.credentials().clientId,
            redirect_uri: p.redirectUri,
            scope: 'openid email profile',
            state: p.state,
            nonce: p.nonce,
            code_challenge: p.codeChallenge,
            code_challenge_method: 'S256',
            prompt: 'select_account',
        }).toString();
        return url.toString();
    }
    async exchangeCode(p) {
        const { clientId, clientSecret } = this.credentials();
        const res = await this.http.request({
            method: 'POST',
            url: exports.GOOGLE_ENDPOINTS.token,
            form: {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: p.redirectUri,
                code: p.code,
                code_verifier: p.codeVerifier,
            },
        });
        const body = (0, oauth_provider_1.parseProviderBody)(this.provider, 'token exchange', res, tokenSchema);
        return { accessToken: body.access_token, idToken: body.id_token };
    }
    async fetchProfile(tokens, ctx) {
        if (!tokens.idToken)
            throw new oauth_provider_1.OAuthProviderError(this.provider, 'missing id_token');
        const c = await this.verifier.verify(tokens.idToken, {
            audience: this.credentials().clientId,
            nonce: ctx.nonce,
        });
        const email = (0, oauth_provider_1.cleanEmail)(c.email);
        const verified = c.email_verified === true || c.email_verified === 'true';
        return {
            provider: this.provider,
            providerUserId: c.sub,
            email,
            emailVerified: email !== null && verified,
            name: (0, oauth_provider_1.cleanText)(c.name, 50),
            nickname: (0, oauth_provider_1.cleanText)(c.given_name ?? c.name, 30),
            phone: null,
            profileImageUrl: (0, oauth_provider_1.cleanImageUrl)(c.picture),
        };
    }
    credentials() {
        const clientId = this.config.get('GOOGLE_CLIENT_ID');
        const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET');
        if (!clientId || !clientSecret)
            throw new oauth_provider_1.OAuthProviderError(this.provider, 'not configured');
        return { clientId, clientSecret };
    }
};
exports.GoogleOAuthProvider = GoogleOAuthProvider;
exports.GoogleOAuthProvider = GoogleOAuthProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(oauth_http_1.OAUTH_HTTP)),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig, Object, google_id_token_verifier_1.GoogleIdTokenVerifier])
], GoogleOAuthProvider);
//# sourceMappingURL=google.provider.js.map