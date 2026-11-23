import { Inject } from '@nestjs/common';
import type { RedisOptions } from 'ioredis';

/** Injection token of the shared ioredis client (keys auto-prefixed with REDIS_KEY_PREFIX). */
export const REDIS = Symbol('REDIS');
export const InjectRedis = (): ParameterDecorator => Inject(REDIS);

/** redis[s]://[user:pass@]host:port/db → ioredis options (used by the client and BullMQ). */
export function redisOptionsFromUrl(url: string): RedisOptions {
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
