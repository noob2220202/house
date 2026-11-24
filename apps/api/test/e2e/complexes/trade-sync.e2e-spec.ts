import { getQueueToken } from '@nestjs/bullmq';
import {
  AdminRole,
  ErrorCode,
  TradeSyncKind,
  TradeSyncStatus,
  type TradeRematchResult,
  type TradeSyncResult,
} from '@house/shared';
import type { Job, Queue } from 'bullmq';
import { AppException } from '../../../src/common/errors/app.exception';
import {
  COMPLEXES_REDIS_KEYS,
  TRADE_SYNC_JOBS,
  TRADE_SYNC_LOCK_TTL_SECONDS,
} from '../../../src/modules/complexes/constants';
import { parseTradeApiResponse } from '../../../src/modules/complexes/trade-sync/trade-api.parser';
import { normalizeTradeBatch } from '../../../src/modules/complexes/trade-sync/trade-normalizer';
import { TradeSyncProcessor } from '../../../src/modules/complexes/trade-sync/trade-sync.processor';
import { TradeSyncService } from '../../../src/modules/complexes/trade-sync/trade-sync.service';
import { QUEUES } from '../../../src/queue/queue.constants';
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
  insertTrade,
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
      emdCode: '12150133',
      emdName: '조례동',
      externalCode: '12150-2002',
    });
    return { ...buyoung, hyundai };
  }

  const sync = (body: unknown, s: TestSession = admin) =>
    withSession(t.http().post(URL), s).send(body as object);
  const rematchReq = (body: unknown, s: TestSession = admin) =>
    withSession(t.http().post(`${URL}/rematch`), s).send(body as object);
  const queue = (): Queue => t.app.get<Queue>(getQueueToken(QUEUES.TRADE_SYNC));

  /** Processes an enqueued job in-process, the way the worker would. */
  async function processJob<T>(jobId: string): Promise<T> {
    const job = await queue().getJob(jobId);
    if (!job) throw new Error(`job ${jobId} not enqueued`);
    return (await t.app.get(TradeSyncProcessor).process(job)) as T;
  }

  /** POST /trade-sync (202) and run the job: the old inline behaviour. */
  async function syncNow(body: unknown): Promise<TradeSyncResult> {
    const res = await sync(body).expect(202);
    return processJob<TradeSyncResult>(res.body.jobId as string);
  }

  async function failure(p: Promise<unknown>): Promise<AppException> {
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    if (!(err instanceof AppException))
      throw new Error(`expected AppException, got ${String(err)}`);
    return err;
  }

  describe('POST /admin/complexes/trade-sync', () => {
    it('answers 202 with a job; the job fetches, normalizes, matches, upserts and builds stats', async () => {
      const { complex, at84, at59, hyundai } = await seedComplexes();
      const res = await sync({ yearMonth: YM }).expect(202);
      expect(res.body).toEqual({
        jobId: `month.12150.${YM}.APT_TRADE+APT_RENT`,
        kind: 'MONTH',
        state: 'waiting',
      });
      // nothing ran inline
      expect(fake.calls).toHaveLength(0);
      const body = await processJob<TradeSyncResult>(res.body.jobId as string);

      expect(body.yearMonth).toBe(YM);
      const [trade, rent] = body.runs;
      expect(trade).toMatchObject({
        kind: 'APT_TRADE',
        status: 'SUCCEEDED',
        sggCode: '12150',
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

    it('dedupes a repeated request while the job is pending', async () => {
      const a = await sync({ yearMonth: YM, kinds: ['APT_TRADE', 'APT_RENT'] }).expect(202);
      const b = await sync({ yearMonth: YM, kinds: ['APT_RENT', 'APT_TRADE'] }).expect(202);
      expect(b.body.jobId).toBe(a.body.jobId);
      const c = await sync({ yearMonth: YM, kinds: ['APT_RENT'] }).expect(202);
      expect(c.body.jobId).toBe(`month.12150.${YM}.APT_RENT`);
      expect(await queue().getWaitingCount()).toBe(2);
    });

    it('never attributes trades to a same-named 단지 with a different 국토교통부 code', async () => {
      const { complex } = await seedBuyoung(t, { externalCode: '12150-7777' });
      await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(await t.prisma.tradeRecord.count({ where: { complexId: complex.id } })).toBe(0);
      expect(await t.prisma.complexTradeStat.count()).toBe(0);
    });

    it('a resync detaches rows its 단지 is now contradicted by and drops their stats', async () => {
      const { complex } = await seedBuyoung(t);
      await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(await t.prisma.tradeRecord.count({ where: { complexId: complex.id } })).toBe(3);
      // the admin learns this 단지 is a different 국토교통부 단지 than the one reported
      await t.prisma.complex.update({
        where: { id: complex.id },
        data: { externalCode: '12150-7777' },
      });
      const again = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(again.runs[0]).toMatchObject({ upsertedCount: 3, matchedCount: 0 });
      expect(await t.prisma.tradeRecord.count({ where: { complexId: complex.id } })).toBe(0);
      expect(await t.prisma.complexTradeStat.count({ where: { complexId: complex.id } })).toBe(0);
    });

    it('is idempotent and applies later 해제 / late reports to the same rows', async () => {
      const { at84 } = await seedComplexes();
      await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      const again = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(again.runs[0]).toMatchObject({ fetchedCount: 6, upsertedCount: 0 });
      expect(await t.prisma.tradeRecord.count()).toBe(5);

      fake.set(TradeSyncKind.APT_TRADE, YM, fixture('apt-trade-202410-resync.xml'));
      const resync = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      // one row flipped to 해제, one late-reported trade added
      expect(resync.runs[0]).toMatchObject({ upsertedCount: 2 });
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
      const res = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(res.runs[0]).toMatchObject({ fetchedCount: 6, upsertedCount: 5 });
      expect(fake.calls.map((c) => c.pageNo)).toEqual([1, 2, 3]);
      expect(fake.calls[0]).toMatchObject({ sggCode: '12150', yearMonth: YM, kind: 'APT_TRADE' });
    });

    it('retries an empty month once with the legacy code (46150) and stores the current codes', async () => {
      const { complex, hyundai } = await seedComplexes();
      const legacyBody = fixture('apt-trade-202410.xml')
        .replaceAll('<sggCd>12150</sggCd>', '<sggCd>46150</sggCd>')
        .replaceAll('<aptSeq>12150-', '<aptSeq>46150-');
      fake.reset();
      fake.set(TradeSyncKind.APT_TRADE, YM, legacyBody, '46150');
      const res = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(res.runs[0]).toMatchObject({
        sggCode: '12150',
        status: 'SUCCEEDED',
        fetchedCount: 6,
        upsertedCount: 5,
        matchedCount: 4,
      });
      expect(fake.calls.map((c) => c.sggCode)).toEqual(['12150', '46150']);
      const rows = await t.prisma.tradeRecord.findMany();
      expect(new Set(rows.map((r) => r.sggCode))).toEqual(new Set(['12150']));
      expect(rows.filter((r) => r.complexId === complex.id)).toHaveLength(3);
      // matched by the canonicalized aptSeq (46150-2002 → 12150-2002)
      expect(rows.find((r) => r.price === 25000)?.complexId).toBe(hyundai.id);

      // a month that is empty under both codes asks each once and succeeds with 0 rows
      fake.reset();
      const empty = await syncNow({ yearMonth: YM, kinds: ['APT_RENT'] });
      expect(empty.runs[0]).toMatchObject({ status: 'SUCCEEDED', fetchedCount: 0 });
      expect(fake.calls.map((c) => c.sggCode)).toEqual(['12150', '46150']);
    });

    it('re-keys contracts stored under the legacy code instead of duplicating them', async () => {
      await seedComplexes();
      // A month synced before 2026-07-01: LAWD_CD 46150, legacy sggCd / aptSeq in the rows.
      const legacyBody = fixture('apt-trade-202410.xml')
        .replaceAll('<sggCd>12150</sggCd>', '<sggCd>46150</sggCd>')
        .replaceAll('<aptSeq>12150-', '<aptSeq>46150-');
      const legacy = normalizeTradeBatch(
        TradeSyncKind.APT_TRADE,
        parseTradeApiResponse(legacyBody).items,
        '46150',
      ).trades;
      // What the pre-migration code stored: keys hashed with 46150 (= today's legacySourceKey).
      for (const tr of legacy) {
        await t.prisma.tradeRecord.create({
          data: {
            sourceKey: tr.legacySourceKey ?? '',
            kind: tr.kind,
            sggCode: '12150', // rewritten by the region-code migration; the key is not
            aptName: tr.aptName,
            dealType: tr.dealType,
            dealDate: tr.dealDate,
            dealYm: tr.dealYm,
            exclusiveArea: tr.exclusiveArea,
            price: tr.price,
            cancelled: tr.cancelled,
            raw: tr.raw,
          },
        });
      }
      expect(await t.prisma.tradeRecord.count()).toBe(5);

      const res = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(res.runs[0]).toMatchObject({ fetchedCount: 6, upsertedCount: 5 });
      const rows = await t.prisma.tradeRecord.findMany();
      expect(rows).toHaveLength(5);
      const current = normalizeTradeBatch(
        TradeSyncKind.APT_TRADE,
        parseTradeApiResponse(fixture('apt-trade-202410.xml')).items,
        '12150',
      ).trades;
      expect(rows.map((r) => r.sourceKey).sort()).toEqual(current.map((c) => c.sourceKey).sort());

      const again = await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
      expect(again.runs[0]).toMatchObject({ upsertedCount: 0 });
      expect(await t.prisma.tradeRecord.count()).toBe(5);
    });

    it('records failed runs; the job fails with per-kind results (retried by BullMQ)', async () => {
      fake.fail(TradeSyncKind.APT_RENT, YM, quotaError());
      const res = await sync({ yearMonth: YM }).expect(202);
      const err = await failure(processJob(res.body.jobId as string));
      expect(err.code).toBe(ErrorCode.TRADE_SYNC_FAILED);
      expect(err.getStatus()).toBe(502);
      const details = err.details as {
        retryable: boolean;
        runs: { kind: string; status: string }[];
      };
      expect(details.retryable).toBe(true);
      expect(details.runs.map((r) => [r.kind, r.status])).toEqual([
        ['APT_TRADE', 'SUCCEEDED'],
        ['APT_RENT', 'FAILED'],
      ]);
      const failed = await t.prisma.tradeSyncRun.findFirstOrThrow({
        where: { status: TradeSyncStatus.FAILED },
      });
      expect(failed.error).toContain('LIMITED_NUMBER_OF_SERVICE_REQUESTS');
      expect(failed.finishedAt).not.toBeNull();
    });

    it('a job for a month that is already syncing fails (409) and releases its own lock', async () => {
      await t.redis.set(
        COMPLEXES_REDIS_KEYS.tradeSyncLock('APT_RENT', '12150', YM),
        'other',
        'EX',
        60,
      );
      const res = await sync({ yearMonth: YM }).expect(202);
      const err = await failure(processJob(res.body.jobId as string));
      expect(err.code).toBe(ErrorCode.TRADE_SYNC_IN_PROGRESS);
      expect(await t.prisma.tradeSyncRun.count()).toBe(0);
      // the APT_TRADE lock taken before the conflict was released
      expect(
        await t.redis.exists(COMPLEXES_REDIS_KEYS.tradeSyncLock('APT_TRADE', '12150', YM)),
      ).toBe(0);
      await syncNow({ yearMonth: YM, kinds: ['APT_TRADE'] });
    });

    it('keeps its locks alive with a heartbeat and never extends a lock it lost', async () => {
      const svc = t.app.get(TradeSyncService);
      const key = COMPLEXES_REDIS_KEYS.tradeSyncLock('APT_TRADE', '12150', YM);
      await t.redis.set(key, 'mine', 'EX', 5);
      expect(await svc.extendLocks([{ key, token: 'mine' }])).toBe(1);
      expect(await t.redis.ttl(key)).toBeGreaterThan(TRADE_SYNC_LOCK_TTL_SECONDS - 5);
      await t.redis.set(key, 'someone-else', 'EX', 5);
      expect(await svc.extendLocks([{ key, token: 'mine' }])).toBe(0);
      expect(await t.redis.ttl(key)).toBeLessThanOrEqual(5);
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
      expect(await queue().getWaitingCount()).toBe(0);
    });
  });

  describe('GET /admin/complexes/trade-sync/runs', () => {
    it('lists runs newest first with filters (OPERATOR allowed)', async () => {
      await syncNow({ yearMonth: YM });
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

  describe('GET /admin/complexes/trade-sync/jobs/:jobId', () => {
    it('reports a job from waiting to completed with its result (real worker)', async () => {
      await seedComplexes();
      const op = await adminSession(t, AdminRole.OPERATOR);
      const { body: accepted } = await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(202);
      const url = `${URL}/jobs/${accepted.jobId as string}`;
      const waiting = await withSession(t.http().get(url), op).expect(200);
      expect(waiting.body).toMatchObject({
        jobId: accepted.jobId,
        kind: 'MONTH',
        state: 'waiting',
        params: { yearMonth: YM, kinds: ['APT_TRADE'] },
        attemptsMade: 0,
        result: null,
        finishedAt: null,
      });

      const worker = t.app.get(TradeSyncProcessor).worker;
      const running = worker.run();
      try {
        let view: { state: string; result: TradeSyncResult | null } = waiting.body;
        for (let i = 0; i < 100 && view.state !== 'completed'; i++) {
          await new Promise((r) => setTimeout(r, 50));
          view = (await withSession(t.http().get(url), op).expect(200)).body;
        }
        expect(view.state).toBe('completed');
        expect(view.result?.runs[0]).toMatchObject({ kind: 'APT_TRADE', status: 'SUCCEEDED' });

        // a finished job is replaced by a fresh one on the next request
        const again = await sync({ yearMonth: YM, kinds: ['APT_TRADE'] }).expect(202);
        expect(again.body.jobId).toBe(accepted.jobId);
        for (let i = 0; i < 100; i++) {
          if ((await t.prisma.tradeSyncRun.count()) === 2) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        expect(await t.prisma.tradeSyncRun.count()).toBe(2);
      } finally {
        await worker.close();
        await running;
      }
    });

    it('404 for unknown jobs, 400 for malformed ids, 401 without an admin session', async () => {
      const notFound = await withSession(
        t.http().get(`${URL}/jobs/month.12150.${YM}.APT_TRADE`),
        admin,
      ).expect(404);
      expect(notFound.body.code).toBe(ErrorCode.TRADE_SYNC_JOB_NOT_FOUND);
      await withSession(t.http().get(`${URL}/jobs/repeat:abc`), admin).expect(400);
      await withSession(t.http().get(`${URL}/jobs/other.1`), admin).expect(400);
      await t.http().get(`${URL}/jobs/month.12150.${YM}.APT_TRADE`).expect(401);
      const user = await createUser(t.prisma);
      await withSession(
        t.http().get(`${URL}/jobs/month.12150.${YM}.APT_TRADE`),
        await loginUser(t.app, user),
      ).expect(401);
    });
  });

  describe('POST /admin/complexes/trade-sync/rematch', () => {
    it('enqueues a rematch that matches previously unmatched trades and builds stats', async () => {
      await syncNow({ yearMonth: YM });
      expect(await t.prisma.tradeRecord.count({ where: { complexId: { not: null } } })).toBe(0);
      const { complex } = await seedBuyoung(t);

      const res = await rematchReq({}).expect(202);
      expect(res.body).toEqual({ jobId: 'rematch.12150.all', kind: 'REMATCH', state: 'waiting' });
      expect(await processJob<TradeRematchResult>('rematch.12150.all')).toEqual({
        scanned: 7,
        matched: 5,
        unmatched: 0,
        complexesRecomputed: 1,
      });
      expect(await t.prisma.tradeRecord.count({ where: { complexId: complex.id } })).toBe(5);
      expect(await t.prisma.complexTradeStat.count({ where: { complexId: complex.id } })).toBe(4);

      const again = await rematchReq({ fromYm: YM }).expect(202);
      expect(again.body.jobId).toBe(`rematch.12150.${YM}`);
      expect(await processJob<TradeRematchResult>(again.body.jobId as string)).toMatchObject({
        matched: 0,
        unmatched: 0,
        complexesRecomputed: 0,
      });
      expect(await t.prisma.auditLog.count({ where: { action: 'trade-sync.rematch' } })).toBe(2);
    });

    it('corrects wrong matches: contradicted rows move or detach, deleted 단지 hand theirs over', async () => {
      const wrong = await createComplex(t.prisma, {
        name: '현대아파트',
        emdName: '연향동',
        jibun: '100',
        externalCode: '12150-100',
      });
      const right = await createComplex(t.prisma, {
        name: '현대',
        emdName: '연향동',
        jibun: '555',
        externalCode: '12150-999',
      });
      const gone = await createComplex(t.prisma, { name: '부영', emdName: '덕월동' });
      const replacement = await createComplex(t.prisma, { name: '부영', emdName: '덕월동' });
      // matched by an earlier, weaker matcher: another 현대's trade on `wrong`
      const misplaced = await insertTrade(t, {
        complexId: wrong.id,
        aptName: '현대',
        emdName: '연향동',
        jibun: '555',
        raw: { aptSeq: '12150-999' },
      });
      // a 지번 contradiction with no better candidate → detached
      const orphan = await insertTrade(t, {
        complexId: wrong.id,
        aptName: '현대',
        emdName: '연향동',
        jibun: '777',
      });
      const keep = await insertTrade(t, {
        complexId: wrong.id,
        aptName: '현대아파트',
        emdName: '연향동',
        jibun: '100',
        raw: { aptSeq: '12150-100' },
      });
      // a trade still attached to a 단지 that was soft-deleted outside remove()
      const stale = await insertTrade(t, {
        complexId: gone.id,
        aptName: '부영',
        emdName: '덕월동',
      });
      await t.prisma.complex.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });

      await rematchReq({}).expect(202);
      expect(await processJob<TradeRematchResult>('rematch.12150.all')).toEqual({
        scanned: 4,
        matched: 0,
        unmatched: 1,
        complexesRecomputed: 4,
      });
      const byId = async (id: string) =>
        (await t.prisma.tradeRecord.findUniqueOrThrow({ where: { id } })).complexId;
      expect(await byId(misplaced.id)).toBe(right.id);
      expect(await byId(orphan.id)).toBeNull();
      expect(await byId(keep.id)).toBe(wrong.id);
      expect(await byId(stale.id)).toBe(replacement.id);
      expect(await t.prisma.complexTradeStat.count({ where: { complexId: wrong.id } })).toBe(1);
      expect(await t.prisma.complexTradeStat.count({ where: { complexId: right.id } })).toBe(1);
    });

    it('a rematch job refuses to run while another rematch holds the lock', async () => {
      await t.redis.set(COMPLEXES_REDIS_KEYS.rematchLock('12150'), 'other', 'EX', 60);
      await rematchReq({}).expect(202);
      const err = await failure(processJob('rematch.12150.all'));
      expect(err.code).toBe(ErrorCode.TRADE_SYNC_IN_PROGRESS);
    });

    it('authz and validation', async () => {
      await t.http().post(`${URL}/rematch`).send({}).expect(401);
      await rematchReq({}, await adminSession(t, AdminRole.OPERATOR)).expect(403);
      await rematchReq({ fromYm: 'abc' }).expect(400);
      expect(await queue().getWaitingCount()).toBe(0);
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
      await expect(
        processor.process({ name: TRADE_SYNC_JOBS.REMATCH, data: { fromYm: 1 } } as Job),
      ).rejects.toThrow('invalid trade-sync rematch job payload');
      await expect(processor.process({ name: 'other', data: {} } as Job)).rejects.toThrow(
        'cannot handle',
      );
    });
  });
});
