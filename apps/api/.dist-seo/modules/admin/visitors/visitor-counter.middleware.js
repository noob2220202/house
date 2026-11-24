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
exports.VisitorCounterMiddleware = void 0;
exports.countsAsVisit = countsAsVisit;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const session_resolver_1 = require("../../../common/auth/session-resolver");
const visitor_stats_service_1 = require("./visitor-stats.service");
const SKIPPED_PREFIXES = ['/api/v1/health', '/api/v1/docs'];
/** Whether a request counts as a site visit (GET, not admin / health / docs, not a bot). */
function countsAsVisit(req) {
    if (req.method !== 'GET')
        return false;
    if ((0, session_resolver_1.isAdminPath)(req))
        return false;
    const path = req.originalUrl.split('?')[0] ?? '';
    if (SKIPPED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)))
        return false;
    return !(0, shared_1.isBotUserAgent)(req.headers['user-agent']);
}
/**
 * Feeds the dashboard's "오늘 방문자" HyperLogLog. Applied to every route by AdminModule.
 * The SSR frontend must forward the browser's X-Forwarded-For / User-Agent for anonymous visits to
 * be told apart (TRUST_PROXY decides whether X-Forwarded-For is honoured).
 */
let VisitorCounterMiddleware = class VisitorCounterMiddleware {
    constructor(visitors) {
        this.visitors = visitors;
    }
    use(req, _res, next) {
        if (countsAsVisit(req)) {
            const cookies = req.cookies;
            const ua = req.headers['user-agent'];
            this.visitors.recordSafe((0, visitor_stats_service_1.visitorId)({
                sessionToken: cookies?.[shared_1.COOKIE_NAMES.SESSION],
                ip: req.ip,
                userAgent: typeof ua === 'string' ? ua : null,
            }), new Date(), (0, visitor_stats_service_1.deviceClassOf)(typeof ua === 'string' ? ua : null));
        }
        next();
    }
};
exports.VisitorCounterMiddleware = VisitorCounterMiddleware;
exports.VisitorCounterMiddleware = VisitorCounterMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [visitor_stats_service_1.VisitorStatsService])
], VisitorCounterMiddleware);
//# sourceMappingURL=visitor-counter.middleware.js.map