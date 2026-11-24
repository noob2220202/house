import type Redis from 'ioredis';
/**
 * Small JSON cache on the shared Redis client (keys get REDIS_KEY_PREFIX automatically).
 * Use namespaced keys: `cache:<module>:<what>:<params>`. Values must be JSON-serializable
 * (convert Decimal/Date first). Cache failures never fail the request.
 */
export declare class CacheService {
    private readonly redis;
    private readonly logger;
    constructor(redis: Redis);
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
    /** Read-through: returns the cached value or computes, stores and returns it. */
    getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T>;
    /**
     * Version-bump invalidation for a namespace: include `await cache.version('ads:serve')` in keys
     * and call `bump('ads:serve')` after writes; old keys simply expire.
     */
    version(namespace: string): Promise<number>;
    bump(namespace: string): Promise<void>;
}
