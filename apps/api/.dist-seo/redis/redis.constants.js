"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectRedis = exports.REDIS = void 0;
exports.redisOptionsFromUrl = redisOptionsFromUrl;
const common_1 = require("@nestjs/common");
/** Injection token of the shared ioredis client (keys auto-prefixed with REDIS_KEY_PREFIX). */
exports.REDIS = Symbol('REDIS');
const InjectRedis = () => (0, common_1.Inject)(exports.REDIS);
exports.InjectRedis = InjectRedis;
/** redis[s]://[user:pass@]host:port/db → ioredis options (used by the client and BullMQ). */
function redisOptionsFromUrl(url) {
    const u = new URL(url);
    const db = u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0;
    return {
        host: u.hostname,
        port: u.port ? Number(u.port) : 6379,
        db: Number.isInteger(db) ? db : 0,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
        tls: u.protocol === 'rediss:' ? {} : undefined,
    };
}
//# sourceMappingURL=redis.constants.js.map