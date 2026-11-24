"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACTED = void 0;
exports.redactUrl = redactUrl;
/**
 * Strips sensitive query values from a request URL before it is logged.
 *
 * Logs keep the path and the query keys (useful for debugging) but never the values of
 * parameters that carry credentials (OAuth code/state), PII (search text that may be a phone
 * number, contact fields) or location (bbox/lat/lng — the 위치기반서비스 terms promise that
 * location is not stored). Unparseable input is reduced to its path only.
 */
exports.REDACTED = '[redacted]';
/** Exact query keys (compared lowercase) whose values are always redacted. */
const SENSITIVE_KEYS = new Set([
    'code',
    'state',
    'nonce',
    'q',
    'query',
    'keyword',
    'phone',
    'bbox',
    'lat',
    'lng',
    'returnto',
    'redirect',
    'redirect_uri',
    'email',
    'name',
    'address',
    'error_description',
]);
/** Substrings that mark a key as sensitive (e.g. contactPhone, accessToken, roadAddress, swLat). */
const SENSITIVE_PATTERN = /phone|email|token|secret|password|passwd|otp|address|lat|lng|bbox/i;
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_.\-[\]]{0,63}$/;
const isSensitiveKey = (key) => SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_PATTERN.test(key);
// Only used to satisfy the WHATWG parser for relative request targets; never logged.
const PARSE_BASE = 'http://redact.invalid';
function redactUrl(url) {
    if (!url)
        return '';
    const hashless = url.split('#')[0] ?? '';
    const queryAt = hashless.indexOf('?');
    if (queryAt === -1)
        return hashless;
    let parsed;
    try {
        parsed = new URL(hashless, PARSE_BASE);
    }
    catch {
        return hashless.slice(0, queryAt);
    }
    // Keep the original path text (relative or absolute form as received) rather than the
    // parser's normalised one; only the query is rewritten.
    const path = hashless.slice(0, queryAt);
    const parts = [];
    for (const [key, value] of parsed.searchParams) {
        // A key that is not a plain identifier may itself be data (e.g. "?01012345678").
        if (!SAFE_KEY.test(key))
            parts.push(exports.REDACTED);
        else if (isSensitiveKey(key))
            parts.push(`${key}=${exports.REDACTED}`);
        else
            parts.push(`${key}=${encodeURIComponent(value)}`);
    }
    return parts.length > 0 ? `${path}?${parts.join('&')}` : path;
}
//# sourceMappingURL=redact-url.js.map