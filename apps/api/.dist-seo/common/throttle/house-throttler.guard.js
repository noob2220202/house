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
exports.HouseThrottlerGuard = void 0;
exports.principalTracker = principalTracker;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const session_resolver_1 = require("../auth/session-resolver");
/** Bucket key for a resolved principal: one bucket per account, not per shared IP. */
function principalTracker(principal) {
    return principal.kind === 'ADMIN' ? `admin:${principal.adminId}` : `user:${principal.userId}`;
}
/**
 * ThrottlerGuard keyed by account when the request carries a valid session, else by client IP.
 *
 * Per-IP-only keys punish users behind CGNAT (mobile carriers put many subscribers on one IP)
 * and make every SSR call from the Next.js server share one 127.0.0.1 bucket. Anonymous traffic
 * still falls back to req.ip, which honours TRUST_PROXY: the SSR server must forward the
 * visitor's X-Forwarded-For (nginx sets it to $remote_addr) so loopback-trusted calls are keyed
 * by the real client.
 *
 * Runs before AuthGuard; the session lookup is memoized per request so AuthGuard reuses it.
 */
let HouseThrottlerGuard = class HouseThrottlerGuard extends throttler_1.ThrottlerGuard {
    constructor(options, storage, reflector, sessions) {
        super(options, storage, reflector);
        this.sessions = sessions;
    }
    async getTracker(req) {
        const session = await (0, session_resolver_1.resolveSessionOnce)(req, this.sessions);
        if (session)
            return principalTracker(session.principal);
        return `ip:${await super.getTracker(req)}`;
    }
};
exports.HouseThrottlerGuard = HouseThrottlerGuard;
exports.HouseThrottlerGuard = HouseThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, throttler_1.InjectThrottlerOptions)()),
    __param(1, (0, throttler_1.InjectThrottlerStorage)()),
    __param(3, (0, common_1.Inject)(session_resolver_1.SESSION_RESOLVER)),
    __metadata("design:paramtypes", [Object, Object, core_1.Reflector, Object])
], HouseThrottlerGuard);
//# sourceMappingURL=house-throttler.guard.js.map