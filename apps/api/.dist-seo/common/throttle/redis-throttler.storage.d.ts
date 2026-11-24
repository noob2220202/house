import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
interface ThrottlerStorageRecord {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}
/** Redis-backed storage so limits hold across API processes. Keys: <prefix>throttle:<name>:<key>. */
export declare class RedisThrottlerStorage implements ThrottlerStorage {
    private readonly command;
    constructor(redis: Redis);
    increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord>;
}
export {};
