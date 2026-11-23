import { ComplexPopularityService } from '../../../src/modules/complexes/services/complex-popularity.service';
import { TRADE_SYNC_JOBS } from '../../../src/modules/complexes/constants';
import { TradeSyncProcessor } from '../../../src/modules/complexes/trade-sync/trade-sync.processor';
import type { Job } from 'bullmq';
import { createComplex, resetAll, type TestApp } from '../../utils';
import { createComplexesApp, FakeTradeApi } from './helpers';

describe('complexes (e2e): environment + view counters', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createComplexesApp(new FakeTradeApi());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_complexes?');
    expect(process.env.REDIS_DB).toBe('3');
    const [row] = await t.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('house_test_complexes');
    expect(t.redis.options.db).toBe(3);
    await t.http().get('/api/v1/health/ready').expect(200);
  });

  it('flushes deduped view totals to complexes.view_count idempotently (worker job)', async () => {
    const c = await createComplex(t.prisma, { viewCount: 10 });
    for (const ua of ['a', 'b', 'a']) {
      await t.http().get(`/api/v1/complexes/${c.id}`).set('User-Agent', ua).expect(200);
    }
    const processor = t.app.get(TradeSyncProcessor);
    expect(await processor.process({ name: TRADE_SYNC_JOBS.FLUSH_VIEWS, data: {} } as Job)).toEqual(
      { flushed: 1 },
    );
    expect((await t.prisma.complex.findUniqueOrThrow({ where: { id: c.id } })).viewCount).toBe(12);
    expect(await t.app.get(ComplexPopularityService).flush()).toBe(0);
    expect((await t.prisma.complex.findUniqueOrThrow({ where: { id: c.id } })).viewCount).toBe(12);
    // the next view continues from the persisted total
    await t.http().get(`/api/v1/complexes/${c.id}`).set('User-Agent', 'c').expect(200);
    const detail = await t
      .http()
      .get(`/api/v1/complexes/${c.id}`)
      .set('User-Agent', 'c')
      .expect(200);
    expect(detail.body.viewCount).toBe(13);
  });
});
