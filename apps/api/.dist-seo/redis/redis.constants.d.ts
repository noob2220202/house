import type { RedisOptions } from 'ioredis';
/** Injection token of the shared ioredis client (keys auto-prefixed with REDIS_KEY_PREFIX). */
export declare const REDIS: unique symbol;
export declare const InjectRedis: () => ParameterDecorator;
/** redis[s]://[user:pass@]host:port/db → ioredis options (used by the client and BullMQ). */
export declare function redisOptionsFromUrl(url: string): RedisOptions;
