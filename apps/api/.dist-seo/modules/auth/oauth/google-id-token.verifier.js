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
var GoogleIdTokenVerifier_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleIdTokenVerifier = exports.GOOGLE_ISSUERS = exports.GOOGLE_JWKS_URL = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const oauth_http_1 = require("./oauth-http");
const oauth_provider_1 = require("./oauth-provider");
exports.GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
exports.GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const CLOCK_SKEW_SECONDS = 60;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;
/** Unknown `kid` triggers a refetch (key rotation), but at most this often. */
const MIN_REFETCH_INTERVAL_MS = 30_000;
const headerSchema = zod_1.z.object({
    alg: zod_1.z.string(),
    kid: zod_1.z.string().min(1),
    typ: zod_1.z.string().optional(),
});
const claimsSchema = zod_1.z.object({
    iss: zod_1.z.string(),
    aud: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]),
    azp: zod_1.z.string().optional(),
    sub: zod_1.z.string().min(1).max(255),
    exp: zod_1.z.number(),
    iat: zod_1.z.number(),
    nonce: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    email_verified: zod_1.z.union([zod_1.z.boolean(), zod_1.z.enum(['true', 'false'])]).optional(),
    name: zod_1.z.string().optional(),
    given_name: zod_1.z.string().optional(),
    family_name: zod_1.z.string().optional(),
    picture: zod_1.z.string().optional(),
});
const jwksSchema = zod_1.z.object({
    keys: zod_1.z.array(zod_1.z
        .object({
        kty: zod_1.z.string(),
        kid: zod_1.z.string(),
        n: zod_1.z.string().optional(),
        e: zod_1.z.string().optional(),
        alg: zod_1.z.string().optional(),
        use: zod_1.z.string().optional(),
    })
        .loose()),
});
/**
 * Verifies Google OIDC id_tokens (RS256) against Google's JWKS: signature, iss, aud, exp/iat, nonce.
 * Keys are cached in memory per process, honouring Cache-Control max-age.
 */
let GoogleIdTokenVerifier = GoogleIdTokenVerifier_1 = class GoogleIdTokenVerifier {
    constructor(http) {
        this.http = http;
        this.logger = new common_1.Logger(GoogleIdTokenVerifier_1.name);
        this.keys = new Map();
        this.expiresAt = 0;
        this.lastFetchAt = 0;
        this.inflight = null;
    }
    async verify(idToken, opts) {
        const fail = (msg) => {
            throw new oauth_provider_1.OAuthProviderError(shared_1.AuthProvider.GOOGLE, `id_token ${msg}`);
        };
        const parts = idToken.split('.');
        if (parts.length !== 3)
            fail('is not a JWS');
        const [h, p, s] = parts;
        const header = headerSchema.safeParse(decodeJson(h));
        if (!header.success)
            return fail('has an invalid header');
        if (header.data.alg !== 'RS256')
            fail(`uses unsupported alg ${header.data.alg}`);
        const key = await this.getKey(header.data.kid, opts.now ?? Date.now());
        if (!key)
            return fail('signed by an unknown key');
        const ok = (0, node_crypto_1.verify)('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
        if (!ok)
            fail('signature is invalid');
        const claims = claimsSchema.safeParse(decodeJson(p));
        if (!claims.success)
            return fail('has invalid claims');
        const c = claims.data;
        const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
        if (!exports.GOOGLE_ISSUERS.includes(c.iss))
            fail('has a wrong issuer');
        const audiences = Array.isArray(c.aud) ? c.aud : [c.aud];
        if (!audiences.includes(opts.audience))
            fail('has a wrong audience');
        if (audiences.length > 1 && c.azp !== opts.audience)
            fail('has a wrong azp');
        if (c.exp + CLOCK_SKEW_SECONDS < nowSec)
            fail('is expired');
        if (c.iat - CLOCK_SKEW_SECONDS > nowSec)
            fail('is issued in the future');
        if (!c.nonce || c.nonce !== opts.nonce)
            fail('nonce mismatch');
        return c;
    }
    async getKey(kid, now) {
        const cached = now < this.expiresAt ? this.keys.get(kid) : undefined;
        if (cached)
            return cached;
        if (now - this.lastFetchAt >= MIN_REFETCH_INTERVAL_MS || now >= this.expiresAt) {
            this.inflight ??= this.refresh(now).finally(() => {
                this.inflight = null;
            });
            await this.inflight;
        }
        return this.keys.get(kid);
    }
    async refresh(now) {
        this.lastFetchAt = now;
        const res = await this.http.request({ method: 'GET', url: exports.GOOGLE_JWKS_URL });
        const parsed = jwksSchema.safeParse(res.body);
        if (res.status !== 200 || !parsed.success) {
            this.logger.warn({ status: res.status }, 'failed to fetch Google JWKS');
            return;
        }
        const keys = new Map();
        for (const jwk of parsed.data.keys) {
            if (jwk.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig'))
                continue;
            try {
                keys.set(jwk.kid, (0, node_crypto_1.createPublicKey)({ key: jwk, format: 'jwk' }));
            }
            catch {
                this.logger.warn({ kid: jwk.kid }, 'skipping unparseable Google JWK');
            }
        }
        this.keys = keys;
        this.expiresAt = now + maxAgeMs(res.headers['cache-control']);
    }
};
exports.GoogleIdTokenVerifier = GoogleIdTokenVerifier;
exports.GoogleIdTokenVerifier = GoogleIdTokenVerifier = GoogleIdTokenVerifier_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(oauth_http_1.OAUTH_HTTP)),
    __metadata("design:paramtypes", [Object])
], GoogleIdTokenVerifier);
function decodeJson(segment) {
    try {
        return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    }
    catch {
        return null;
    }
}
function maxAgeMs(cacheControl) {
    const m = /max-age=(\d+)/i.exec(cacheControl ?? '');
    const seconds = m ? Number(m[1]) : NaN;
    return Number.isFinite(seconds) && seconds > 0
        ? Math.min(seconds * 1000, 24 * DEFAULT_JWKS_TTL_MS)
        : DEFAULT_JWKS_TTL_MS;
}
//# sourceMappingURL=google-id-token.verifier.js.map