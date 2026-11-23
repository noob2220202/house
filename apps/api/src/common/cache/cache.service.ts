import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.constants';

/**
 * Small JSON cache on the shared Redis client (keys get REDIS_KEY_PREFIX automatically).
 * Use namespaced keys: `cache:<module>:<what>:<params>`. Values must be JSON-serializable
 * (convert Decimal/Date first). Cache failures never fail the request.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (err) {
      this.logger.warn({ err, key }, 'cache get failed');
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
    } catch (err) {
      this.logger.warn({ err, key }, 'cache set failed');
    }
  }

  /** Read-through: returns the cached value or computes, stores and returns it. */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Version-bump invalidation for a namespace: include `await cache.version('ads:serve')` in keys
   * and call `bump('ads:serve')` after writes; old keys simply expire.
   */
  async version(namespace: string): Promise<number> {
    try {
      return Number((await this.redis.get(`cache-version:${namespace}`)) ?? 0);
    } catch {
      return 0;
    }
  }

  async bump(namespace: string): Promise<void> {
    try {
      await this.redis.incr(`cache-version:${namespace}`);
    } catch (err) {
      this.logger.warn({ err, namespace }, 'cache bump failed');
    }
  }
}
