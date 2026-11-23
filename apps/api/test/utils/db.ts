import type Redis from 'ioredis';
import type { PrismaService } from '../../src/prisma/prisma.service';

/** Tables that must survive a reset (migration bookkeeping, PostGIS catalog). */
const KEEP_TABLES = new Set(['_prisma_migrations', 'spatial_ref_sys']);

/**
 * Truncates every application table in the current (test) database. Table names come from the
 * catalog, never from user input, and are quoted — so the unsafe raw call is fine here.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase();
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const tables = rows.map((r) => r.tablename).filter((t) => !KEEP_TABLES.has(t));
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.replace(/"/g, '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Flushes the module's own Redis DB index (sessions, throttles, caches, queues). */
export async function resetRedis(redis: Redis): Promise<void> {
  const db = Number(process.env.REDIS_DB);
  if (!Number.isInteger(db) || db < 1)
    throw new Error('resetRedis: REDIS_DB must be a test index (>=1)');
  await redis.flushdb();
}

/** Both resets; call in beforeEach (or beforeAll for read-only suites). */
export async function resetAll(ctx: { prisma: PrismaService; redis: Redis }): Promise<void> {
  await Promise.all([resetDatabase(ctx.prisma), resetRedis(ctx.redis)]);
}

function assertTestDatabase(): void {
  if (!/\/house_test_[a-z_]+(\?|$)/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('resetDatabase: DATABASE_URL is not a house_test_* database');
  }
}
