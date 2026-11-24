"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthProviderError = exports.OAUTH_PROVIDERS = void 0;
exports.parseProviderBody = parseProviderBody;
exports.normalizeProviderPhone = normalizeProviderPhone;
exports.cleanText = cleanText;
exports.cleanImageUrl = cleanImageUrl;
exports.cleanEmail = cleanEmail;
const shared_1 = require("@house/shared");
exports.OAUTH_PROVIDERS = Symbol('OAUTH_PROVIDERS');
/** Provider-side failure (bad response, rejected code, invalid id_token). Message is for logs only. */
class OAuthProviderError extends Error {
    constructor(provider, message) {
        super(`[${provider}] ${message}`);
        this.provider = provider;
        this.name = 'OAuthProviderError';
    }
}
exports.OAuthProviderError = OAuthProviderError;
/** Validates a provider response body against a zod schema, or throws OAuthProviderError. */
function parseProviderBody(provider, what, res, schema) {
    if (res.status < 200 || res.status >= 300) {
        throw new OAuthProviderError(provider, `${what} failed with HTTP ${res.status}`);
    }
    const parsed = schema.safeParse(res.body);
    if (!parsed.success) {
        throw new OAuthProviderError(provider, `${what} returned an unexpected body`);
    }
    return parsed.data;
}
/** Provider phone ("+82 10-1234-5678") → "01012345678", or null when absent / not a mobile number. */
function normalizeProviderPhone(raw) {
    if (!raw)
        return null;
    const parsed = shared_1.phoneSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}
/** Trims and bounds free-text profile fields to the column sizes. */
function cleanText(value, max) {
    if (typeof value !== 'string')
        return null;
    const t = value.trim();
    return t.length === 0 ? null : t.slice(0, max);
}
/** Only https image URLs are kept (http is upgraded: Kakao still returns some http CDN URLs). */
function cleanImageUrl(value) {
    if (typeof value !== 'string' || value.length > 1000)
        return null;
    try {
        const u = new URL(value);
        if (u.protocol === 'http:')
            u.protocol = 'https:';
        return u.protocol === 'https:' ? u.toString() : null;
    }
    catch {
        return null;
    }
}
function cleanEmail(value) {
    if (typeof value !== 'string')
        return null;
    const t = value.trim().toLowerCase();
    return t.length > 0 && t.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(t) ? t : null;
}
//# sourceMappingURL=oauth-provider.js.map