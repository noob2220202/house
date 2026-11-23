import { AdminRole, ErrorCode, TradeSyncKind, TradeSyncStatus } from '@house/shared';
import type { Job } from 'bullmq';
import { COMPLEXES_REDIS_KEYS, TRADE_SYNC_JOBS } from '../../../src/modules/complexes/constants';
import { TradeSyncProcessor } from '../../../src/modules/complexes/trade-sync/trade-sync.processor';
import {
  createComplex,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import {
  adminSession,
  createComplexesApp,
  FakeTradeApi,
  fixture,
  quotaError,
  seedBuyoung,
  seedRegions,
} from './helpers';

const URL = '/api/v1/admin/complexes/trade-sync';
const YM = 202410;

describe('complexes: 실거래가 sync (e2e)', () => {
  let t: TestApp;
  const fake = new FakeTradeApi();
  let admin: TestSession;

  beforeAll(async () => {
    t = await createComplexesApp(fake);
  });
  beforeEach(async () => {
    await resetAll(t);
    fake.reset();
    fake
      .set(TradeSyncKind.APT_TRADE, YM, fixture('apt-trade-202410.xml'))
      .set(TradeSyncKind.APT_RENT, YM, fixture('apt-rent-202410.xml'));
    await seedRegions(t);
    admin = await adminSession(t);
  });
  afterAll(() => t?.close());

  async function seedComplexes() {
    const buyoung = await seedBuyoung(t);
    const hyundai = await createComplex(t.prisma, {
      name: '조례현대',
      emdCode: '46150133',
      emdName: '조례동',
      externalCode: '46150-2002',
    });
    return { ...buyoung, hyundai };
  }

  const sync = (body: unknown, s: TestSession = admin) =>
    withSession(t.http().post(URL), s).send(body as object);

  describe('POST /admin/complexes/trade-sync', () => {
    it('fetches, normalizes, matches, upserts and builds stats', async () => {
      const { complex, at84, at59, hyundai } = await seedComplexes();
      const res = await sync({ yearMonth: YM }).expect(200);

      expect(res.body.yearMonth).toBe(YM);
      const [trade, rent] = res.body.runs;
      expect(trade).toMatchObject({
        kind: 'APT_TRADE',
        status: 'SUCCEEDED',
        sggCode: '46150',
        fetchedCount: 6,
        upsertedCount: 5,
        matchedCount: 4,
      });
      expect(rent).toMatchObject({
        kind: 'APT_RENT',
        status: 'SUCCEEDED',
        upsertedCount: 2,
        matchedCount: 2,
      });

      const rows = await t.prisma.tradeRecord.findMany({ orderBy: { dealDate: 'asc' } });
      expect(rows).toHaveLength(7);
      const buyoungSales = rows.filter((r) => r.complexId === complex.id && r.kind === 'APT_TRADE');
      expect(buyoungSales.map((r) => [r.price, r.areaTypeId, r.cancelled])).toEqual([
        [18500, at84.id, false],
        [19000, at84.id, true],
        [17000, at59.id, false],
      ]);
      expect(rows.find((r) => r.price === 25000)?.complexId).toBe(hyundai.id);
      expect(rows.find((r) => r.aptName === '미등록아파트')?.complexId).toBeNull();
      expect(rows.find((r) => r.monthlyRent === 45)).toMatchObject({
        dealType: 'MONTHLY',
        deposit: 2000,
        complexId: complex.id,
        areaTypeId: at59.id,
        contractType: '갱신',
      });

      const stats = await t.prisma.complexTradeStat.findMany({
        where: { complexId: complex.id },
        orderBy: [{ dealType: 'asc' }, { exclusiveArea: 'asc' }],
      });
      expect(
        stats.map((s) => [
          s.dealType,
          s.exclusiveArea.toFixed(2),
          s.tradeCount,
          s.medianPrice,
          s.medianMonthlyRent,
        ]),
      ).toEqual([
        ['SALE', '59.84', 1, 17000, null],
        ['SALE', '84.97', 1, 18500, null], // the 해제 trade (19,000) is excluded
        ['JEONSE', '84.97', 1, 12000, null],
        ['MONTHLY', '59.84', 1, 2000, 45],
      ]);

      const audit = await t.prisma.auditLog.findFirst({ where: { action: 'trade-sync.run' } });
      expect(audit).toMatchObject({ actorType: 'ADMIN', resourceType: 'TradeSyncRun' });
    });

    it('is idempotent and applies later 해제 / late reports to the same rows', async () => {
      const { at84 } = await seedComplexes();
      await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(200);
      const again = await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(200);
      expect(again.body.runs[0]).toMatchObject({ fetchedCount: 6, upsertedCount: 0 });
      expect(await t.prisma.tradeRecord.count()).toBe(5);

      fake.set(TradeSyncKind.APT_TRADE, YM, fixture('apt-trade-202410-resync.xml'));
      const resync = await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(200);
      // one row flipped to 해제, one late-reported trade added
      expect(resync.body.runs[0]).toMatchObject({ upsertedCount: 2 });
      expect(await t.prisma.tradeRecord.count()).toBe(6);
      const first = await t.prisma.tradeRecord.findFirstOrThrow({ where: { price: 18500 } });
      expect(first.cancelled).toBe(true);
      expect(first.cancelledAt?.toISOString().slice(0, 10)).toBe('2024-11-02');
      const stat = await t.prisma.complexTradeStat.findFirstOrThrow({
        where: { dealType: 'SALE', exclusiveArea: at84.exclusiveArea },
      });
      expect([stat.tradeCount, stat.medianPrice]).toEqual([1, 18800]);
    });

    it('follows pagination until totalCount', async () => {
      await seedComplexes();
      fake.maxRowsPerPage = 2;
      const res = await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(200);
      expect(res.body.runs[0]).toMatchObject({ fetchedCount: 6, upsertedCount: 5 });
      expect(fake.calls.map((c) => c.pageNo)).toEqual([1, 2, 3]);
      expect(fake.calls[0]).toMatchObject({ sggCode: '46150', yearMonth: YM, kind: 'APT_TRADE' });
    });

    it('records failed runs and answers 502 with per-kind results', async () => {
      fake.fail(TradeSyncKind.APT_RENT, YM, quotaError());
      const res = await sync({ yearMonth: YM }).expect(502);
      expect(res.body.code).toBe(ErrorCode.TRADE_SYNC_FAILED);
      expect(res.body.details.retryable).toBe(true);
      expect(
        (res.body.details.runs as { kind: string; status: string }[]).map((r) => [
          r.kind,
          r.status,
        ]),
      ).toEqual([
        ['APT_TRADE', 'SUCCEEDED'],
        ['APT_RENT', 'FAILED'],
      ]);
      const failed = await t.prisma.tradeSyncRun.findFirstOrThrow({
        where: { status: TradeSyncStatus.FAILED },
      });
      expect(failed.error).toContain('LIMITED_NUMBER_OF_SERVICE_REQUESTS');
      expect(failed.finishedAt).not.toBeNull();
    });

    it('refuses concurrent runs of the same month (409) and releases its own lock', async () => {
      await t.redis.set(
        COMPLEXES_REDIS_KEYS.tradeSyncLock('APT_RENT', '46150', YM),
        'other',
        'EX',
        60,
      );
      const res = await sync({ yearMonth: YM }).expect(409);
      expect(res.body.code).toBe(ErrorCode.TRADE_SYNC_IN_PROGRESS);
      expect(await t.prisma.tradeSyncRun.count()).toBe(0);
      // the APT_TRADE lock taken before the conflict was released
      expect(
        await t.redis.exists(COMPLEXES_REDIS_KEYS.tradeSyncLock('APT_TRADE', '46150', YM)),
      ).toBe(0);
      await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(200);
    });

    it('400 for future/ancient months and bad bodies; 503 when the API key is missing', async () => {
      expect((await sync({ yearMonth: 209912 }).expect(400)).body.code).toBe(
        ErrorCode.TRADE_SYNC_INVALID_MONTH,
      );
      expect((await sync({ yearMonth: 200001 }).expect(400)).body.code).toBe(
        ErrorCode.TRADE_SYNC_INVALID_MONTH,
      );
      expect((await sync({ yearMonth: '2024-10' }).expect(400)).body.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      );
      expect((await sync({ yearMonth: YM, kinds: ['APT_SALE'] }).expect(400)).body.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      );
      await sync({}).expect(400);
      fake.configured = false;
      expect((await sync({ yearMonth: YM }).expect(503)).body.code).toBe(
        ErrorCode.TRADE_SYNC_NOT_CONFIGURED,
      );
    });

    it('authz: anonymous / user / no-TOTP admin → 401, OPERATOR → 403, no CSRF → 403', async () => {
      await t.http().post(URL).send({ yearMonth: YM }).expect(401);
      const user = await createUser(t.prisma);
      await sync({ yearMonth: YM }, await loginUser(t.app, user)).expect(401);
      const noMfa = await adminSession(t, AdminRole.ADMIN, { mfaVerified: false });
      expect((await sync({ yearMonth: YM }, noMfa).expect(401)).body.code).toBe(
        ErrorCode.AUTH_TOTP_REQUIRED,
      );
      await sync({ yearMonth: YM }, await adminSession(t, AdminRole.OPERATOR)).expect(403);
      await t
        .http()
        .post(URL)
        .set('Cookie', admin.cookie)
        .set('Origin', admin.origin)
        .send({ yearMonth: YM })
        .expect(403);
      expect(fake.calls).toHaveLength(0);
    });
  });

  describe('GET /admin/complexes/trade-sync/runs', () => {
    it('lists runs newest first with filters (OPERATOR allowed)', async () => {
      await sync({ yearMonth: YM }).expect(200);
      const op = await adminSession(t, AdminRole.OPERATOR);
      const all = await withSession(t.http().get(`${URL}/runs`), op).expect(200);
      expect(all.body).toMatchObject({ total: 2, page: 1, totalPages: 1 });
      const rent = await withSession(
        t.http().get(`${URL}/runs?kind=APT_RENT&yearMonth=${YM}`),
        op,
      ).expect(200);
      expect(rent.body.items).toHaveLength(1);
      expect(rent.body.items[0]).toMatchObject({
        kind: 'APT_RENT',
        status: 'SUCCEEDED',
        yearMonth: YM,
      });
    });

    it('401 without an admin session, 400 for bad filters', async () => {
      await t.http().get(`${URL}/runs`).expect(401);
      const user = await createUser(t.prisma);
      await withSession(t.http().get(`${URL}/runs`), await loginUser(t.app, user)).expect(401);
      await withSession(t.http().get(`${URL}/runs?status=DONE`), admin).expect(400);
      await withSession(t.http().get(`${URL}/runs?pageSize=1000`), admin).expect(400);
    });
  });

  describe('POST /admin/complexes/trade-sync/rematch', () => {
    it('matches previously unmatched trades after a 단지 is added and builds its stats', async () => {
      const first = await sync({ yearMonth: YM }).expect(200);
      expect(first.body.runs[0].matchedCount).toBe(0);
      const { complex } = await seedBuyoung(t);

      const res = await withSession(t.http().post(`${URL}/rematch`), admin)
        .send({})
        .expect(200);
      expect(res.body).toEqual({ scanned: 7, matched: 5, complexesRecomputed: 1 });
      expect(await t.prisma.tradeRecord.count({ where: { complexId: complex.id } })).toBe(5);
      expect(await t.prisma.complexTradeStat.count({ where: { complexId: complex.id } })).toBe(4);

      const again = await withSession(t.http().post(`${URL}/rematch`), admin)
        .send({ fromYm: YM })
        .expect(200);
      expect(again.body).toMatchObject({ matched: 0, complexesRecomputed: 0 });
      expect(await t.prisma.auditLog.count({ where: { action: 'trade-sync.rematch' } })).toBe(2);
    });

    it('authz and validation', async () => {
      await t.http().post(`${URL}/rematch`).send({}).expect(401);
      await withSession(t.http().post(`${URL}/rematch`), await adminSession(t, AdminRole.OPERATOR))
        .send({})
        .expect(403);
      await withSession(t.http().post(`${URL}/rematch`), admin)
        .send({ fromYm: 'abc' })
        .expect(400);
    });
  });

  describe('trade-sync worker', () => {
    it('monthly job syncs the current month plus the lookback months', async () => {
      const processor = t.app.get(TradeSyncProcessor);
      const out = await processor.syncRecentMonths(new Date('2024-12-05T00:00:00Z'));
      expect(out.months).toEqual([202409, 202410, 202411, 202412]);
      expect(await t.prisma.tradeSyncRun.count({ where: { status: 'SUCCEEDED' } })).toBe(8);
      expect(await t.prisma.tradeRecord.count()).toBe(7);

      fake.configured = false;
      expect(await processor.syncRecentMonths(new Date())).toMatchObject({
        skipped: 'not configured',
      });
    });

    it('handles one-off month jobs and rejects unknown jobs / payloads', async () => {
      const processor = t.app.get(TradeSyncProcessor);
      const res = (await processor.process({
        name: TRADE_SYNC_JOBS.MONTH,
        data: { yearMonth: YM, kinds: ['APT_RENT'] },
      } as Job)) as { runs: unknown[] };
      expect(res.runs).toHaveLength(1);
      await expect(
        processor.process({ name: TRADE_SYNC_JOBS.MONTH, data: { yearMonth: 'x' } } as Job),
      ).rejects.toThrow('invalid trade-sync month job payload');
      await expect(processor.process({ name: 'other', data: {} } as Job)).rejects.toThrow(
        'cannot handle',
      );
    });
  });
});
