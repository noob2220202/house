import { createTestApp, resetAll, type TestApp } from '../../utils';

/**
 * Placeholder e2e suite of the ads module. Replace the todos with real specs (happy path +
 * authz failure + validation failure per endpoint). See src/modules/ads/README.md.
 */
describe('ads (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_ads?');
    expect(process.env.REDIS_DB).toBe('6');
    const [row] = await t.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('house_test_ads');
    expect(t.redis.options.db).toBe(6);
    await t.http().get('/api/v1/health/ready').expect(200);
  });

  it.todo('implements the endpoints listed in src/modules/ads/README.md');
});
