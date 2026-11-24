"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchOAuthHttpClient = exports.OAUTH_HTTP = void 0;
const common_1 = require("@nestjs/common");
exports.OAUTH_HTTP = Symbol('OAUTH_HTTP');
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_000_000;
let FetchOAuthHttpClient = class FetchOAuthHttpClient {
    async request(req) {
        const headers = { Accept: 'application/json', ...req.headers };
        let body;
        if (req.form) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
            body = new URLSearchParams(req.form).toString();
        }
        const res = await fetch(req.url, {
            method: req.method,
            headers,
            body,
            redirect: 'error',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await res.text();
        if (text.length > MAX_BODY_BYTES)
            throw new Error(`OAuth response too large from ${req.url}`);
        let parsed = text;
        if ((res.headers.get('content-type') ?? '').includes('json') || /^\s*[{[]/.test(text)) {
            try {
                parsed = JSON.parse(text);
            }
            catch {
                parsed = text;
            }
        }
        const outHeaders = {};
        res.headers.forEach((value, key) => {
            outHeaders[key.toLowerCase()] = value;
        });
        return { status: res.status, body: parsed, headers: outHeaders };
    }
};
exports.FetchOAuthHttpClient = FetchOAuthHttpClient;
exports.FetchOAuthHttpClient = FetchOAuthHttpClient = __decorate([
    (0, common_1.Injectable)()
], FetchOAuthHttpClient);
//# sourceMappingURL=oauth-http.js.map