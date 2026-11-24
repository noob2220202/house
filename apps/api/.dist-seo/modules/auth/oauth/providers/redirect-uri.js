"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRedirectUri = defaultRedirectUri;
const shared_1 = require("@house/shared");
/** Fixed callback route registered in each provider console. */
function defaultRedirectUri(config, slug) {
    const base = config.get('API_BASE_URL').replace(/\/+$/, '');
    return `${base}/${shared_1.API_PREFIX}/auth/oauth/${slug}/callback`;
}
//# sourceMappingURL=redirect-uri.js.map