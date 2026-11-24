"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisThrottlerStorage = void 0;
/** Fixed-window counter + block key, atomically in one Lua script. */
const SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])
local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return { limit + 1, redis.call('PTTL', hitsKey), 1, blockTtl }
end
local hits = redis.call('INCR', hitsKey)
if hits == 1 then redis.call('PEXPIRE', hitsKey, ttl) end
local hitsTtl = redis.call('PTTL', hitsKey)
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  return { hits, hitsTtl, 1, blockMs }
end
return { hits, hitsTtl, 0, 0 }
`;
/** Redis-backed storage so limits hold across API processes. Keys: <prefix>throttle:<name>:<key>. */
class RedisThrottlerStorage {
    constructor(redis) {
        if (!('houseThrottle' in redis)) {
            redis.defineCommand('houseThrottle', { numberOfKeys: 2, lua: SCRIPT });
        }
        const fn = redis.houseThrottle;
        this.command = fn.bind(redis);
    }
    async increment(key, ttl, limit, blockDuration, throttlerName) {
        const base = `throttle:${throttlerName}:${key}`;
        const [hits, hitsTtl, blocked, blockTtl] = await this.command(`${base}:hits`, `${base}:block`, ttl, limit, blockDuration > 0 ? blockDuration : ttl);
        return {
            totalHits: hits,
            timeToExpire: Math.max(0, Math.ceil(hitsTtl / 1000)),
            isBlocked: blocked === 1,
            timeToBlockExpire: Math.max(0, Math.ceil(blockTtl / 1000)),
        };
    }
}
exports.RedisThrottlerStorage = RedisThrottlerStorage;
//# sourceMappingURL=redis-throttler.storage.js.map