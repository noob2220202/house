import { randomUUID } from 'node:crypto';
import {
  AdminRole,
  ComplexDataSource,
  TradeSyncKind,
  type ComplexBootstrapJobView,
} from '@house/shared';
import { getQueueToken } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import {
  BOOTSTRAP_QUOTA_MESSAGE,
  bootstrapRange,
  ComplexBootstrapService,
} from '../../../src/modules/complexes/bootstrap/complex-bootstrap.service';
import { TRADE_SYNC_JOBS } from '../../../src/modules/complexes/constants';
import { TradeSyncProcessor } from '../../../src/modules/complexes/trade-sync/trade-sync.processor';
import {
  GEOCODER,
  type Geocoder,
  type GeocoderHit,
} from '../../../src/modules/home/clients/kakao-geocode.client';
import { TRADE_API_CLIENT } from '../../../src/modules/complexes/trade-sync/trade-api.client';
import { QUEUES } from '../../../src/queue/queue.constants';
import { createTestApp, resetAll, withSession, type TestApp, type TestSession } from '../../utils';
import { adminSession, FakeTradeApi, quotaError, seedRegions } from './helpers';

const URL = '/api/v1/admin/complexes/bootstrap';
const MONTHS = 12;
const { fromYm, toYm } = bootstrapRange(MONTHS, new Date());
const prevYm = toYm % 100 === 1 ? toYm - 100 + 11 : toYm - 1;

/** Address → hits; queries without an entry find nothing (like an unknown address). */
class FakeGeocoder implements Geocoder {
  configured = true;
  readonly queries: string[] = [];
  readonly hits = new Map<string, GeocoderHit[]>();
  isConfigured(): boolean {
    return this.configured;
  }
  geocode(query: string): Promise<GeocoderHit[]> {
    this.queries.push(query);
    return Promise.resolve(this.hits.get(query) ?? []);
  }
  legalCode(): Promise<string | null> {
    return Promise.resolve(null);
  }
  reset(): void {
    this.configured = true;
    this.queries.length = 0;
    this.hits.clear();
  }
}

function page(items: Record<string, string>[]): string {
  const body = items
    .map(
      (i) =>
        `<item>${Object.entries(i)
          .map(([k, v]) => `<${k}>${v}</${k}>`)
          .join('')}</item>`,
    )
    .join('');
  return `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${body}</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>${items.length}</totalCount></body></response>`;
}

const ymParts = (ym: number) => ({
  dealYear: String(Math.floor(ym / 100)),
  dealMonth: String(ym % 100),
});
const sale = (ym: number, over: Record<string, string>) => ({
  sggCd: '12150',
  ...ymParts(ym),
  dealDay: '3',
  dealAmount: '18,500',
  floor: '5',
  ...over,
});
const rent = (ym: number, over: Record<string, string>) => ({
  sggCd: '12150',
  ...ymParts(ym),
  dealDay: '9',
  deposit: '12,000',
  monthlyRent: '0',
  floor: '3',
  ...over,
});

const BUYOUNG = {
  aptNm: '연향부영3차',
  aptSeq: '12150-1001',
  umdCd: '11400',
  umdNm: '연향동',
  jibun: '1234-5',
  buildYear: '1998',
  roadNm: '연향번영길',
  roadNmBonbun: '00100',
  roadNmBubun: '00000',
};
const HYUNDAI = {
  aptNm: '조례현대',
  aptSeq: '12150-2002',
  umdCd: '13300',
  umdNm: '조례동',
  jibun: '1700',
  buildYear: '2002',
};
const SINDAE = {
  aptNm: '신대중흥S-클래스',
  aptSeq: '12150-9',
  umdCd: '31022',
  umdNm: '신대리',
  jibun: '1990',
  buildYear: '2015',
};
const WANGJI = {
  aptNm: '왕지현대',
  aptSeq: '12150-11',
  umdCd: '13200',
  umdNm: '왕지동',
  jibun: '77',
};

const hit = (lat: number, lng: number, address: string, legalCode: string | null) => ({
  roadAddress: address,
  jibunAddress: address,
  zipCode: null,
  buildingName: null,
  lat,
  lng,
  legalCode,
});

describe('complexes: 단지 bootstrap from 실거래가 (e2e)', () => {
  let t: TestApp;
  const fake = new FakeTradeApi();
  const geo = new FakeGeocoder();
  let admin: TestSession;

  beforeAll(async () => {
    t = await createTestApp({
      override: (b) =>
        b
          .overrideProvider(TRADE_API_CLIENT)
          .useValue(fake)
          .overrideProvider(GEOCODER)
          .useValue(geo),
    });
    Object.assign(t.app.get(ComplexBootstrapService).throttle, {
      apiMs: 0,
      geocodeMs: 0,
      retryMs: 0,
    });
  });
  beforeEach(async () => {
    await resetAll(t);
    fake.reset();
    geo.reset();
    fake
      .set(
        TradeSyncKind.APT_TRADE,
        toYm,
        page([
          sale(toYm, { ...BUYOUNG, excluUseAr: '84.97' }),
          sale(toYm, { ...BUYOUNG, excluUseAr: '84.98', floor: '9' }),
          sale(toYm, { ...BUYOUNG, excluUseAr: '59.84' }),
          sale(toYm, { ...HYUNDAI, excluUseAr: '101.9' }),
          sale(toYm, { ...SINDAE, excluUseAr: '84.99' }),
          sale(toYm, { ...WANGJI, excluUseAr: '59.5' }),
        ]),
      )
      .set(
        TradeSyncKind.APT_RENT,
        toYm,
        page([
          rent(toYm, {
            aptNm: '연향부영3차',
            umdNm: '연향동',
            jibun: '1234-5',
            excluUseAr: '84.97',
          }),
        ]),
      )
      // An older month only answers under the legacy 시군구 code (46150), with legacy codes.
      .set(
        TradeSyncKind.APT_TRADE,
        prevYm,
        page([
          sale(prevYm, { ...HYUNDAI, aptSeq: '46150-2002', sggCd: '46150', excluUseAr: '84.9' }),
        ]),
        '46150',
      );
    geo.hits.set('순천시 연향동 1234-5', [
      hit(34.9601, 127.5208, '전남광주통합특별시 순천시 연향동 1234-5', '1215011400'),
    ]);
    // 지번 not found: the road address is tried next
    geo.hits.set('순천시 연향번영길 100', [
      hit(34.96, 127.52, '전남광주통합특별시 순천시 연향번영길 100', '1215011400'),
    ]);
    geo.hits.set('순천시 조례동 1700', [
      hit(34.9555, 127.5333, '전남광주통합특별시 순천시 조례동 1700', '4615013300'),
    ]);
    geo.hits.set('순천시 해룡면 신대리 1990', [
      hit(34.932, 127.561, '전남광주통합특별시 순천시 해룡면 신대리 1990', null),
    ]);
    // 왕지현대: the geocoder answers with a point outside 순천 → needs a manual location
    geo.hits.set('순천시 왕지동 77', [hit(35.1, 126.9, '광주광역시 북구 왕지동 77', '2917010100')]);
    await seedRegions(t);
    admin = await adminSession(t);
  });
  afterAll(() => t?.close());

  const queue = (): Queue => t.app.get<Queue>(getQueueToken(QUEUES.TRADE_SYNC));
  const start = (body: object, s: TestSession = admin) =>
    withSession(t.http().post(URL), s).send(body);
  const view = async (jobId: string): Promise<ComplexBootstrapJobView> =>
    (await withSession(t.http().get(`${URL}/${jobId}`), admin).expect(200))
      .body as ComplexBootstrapJobView;

  /**
   * Runs the queued jobs of the trade-sync queue in-process (oldest first), completing them like
   * the worker; stops after the first job `until` accepts.
   */
  async function drain(until?: (j: Job) => boolean): Promise<string[]> {
    const worker = t.app.get(TradeSyncProcessor).worker;
    const processed: string[] = [];
    for (let i = 0; i < 200; i++) {
      const token = randomUUID();
      const job = await worker.getNextJob(token, { block: false });
      if (!job) break;
      try {
        const value = await t.app.get(TradeSyncProcessor).process(job);
        await job.moveToCompleted(value, token, false);
      } catch (err) {
        await job.moveToFailed(err as Error, token, false);
      }
      processed.push(job.name);
      if (until?.(job)) break;
    }
    return processed;
  }

  async function runBootstrap(body: object): Promise<ComplexBootstrapJobView> {
    const res = await start(body).expect(202);
    expect(res.body).toMatchObject({ state: 'waiting' });
    await drain((j) => j.name === TRADE_SYNC_JOBS.BOOTSTRAP);
    return view(res.body.jobId as string);
  }

  it('dry run: previews every candidate and writes nothing', async () => {
    const res = await start({ months: MONTHS }).expect(202);
    expect(res.body).toEqual({
      jobId: expect.stringMatching(/^bootstrap\.\d+$/),
      state: 'waiting',
      dryRun: true,
      months: MONTHS,
    });
    const waiting = await view(res.body.jobId as string);
    expect(waiting).toMatchObject({
      status: 'waiting',
      dryRun: true,
      fromYm,
      toYm,
      progress: { phase: 'queued', percent: 0 },
      preview: null,
      result: null,
    });
    // one run at a time
    await start({ months: MONTHS }).expect(409);

    await drain();
    const done = await view(res.body.jobId as string);
    expect(done.status).toBe('completed');
    expect(done.progress).toMatchObject({ phase: 'done', percent: 100 });
    expect(done.result).toBeNull();
    expect(done.preview).toMatchObject({
      fromYm,
      toYm,
      rows: 8,
      candidates: 4,
      toCreate: 3,
      toUpdate: 0,
      unchanged: 0,
      needsLocation: 1,
      skipped: 0,
    });
    const byName = new Map(done.preview?.sample.map((s) => [s.name, s]));
    expect(byName.get('연향부영3차')).toMatchObject({
      action: 'CREATE',
      emdName: '연향동',
      emdCode: '12150114',
      jibunAddress: '순천시 연향동 1234-5',
      roadAddress: '순천시 연향번영길 100',
      builtYear: 1998,
      areaTypeCount: 2,
      exclusiveAreas: [59.84, 84.97],
      hasLocation: true,
      externalCode: '12150-1001',
      saleCount: 3,
      rentCount: 1,
    });
    // legacy-code month merged into the same 단지 (46150-2002 → 12150-2002)
    expect(byName.get('조례현대')).toMatchObject({
      action: 'CREATE',
      externalCode: '12150-2002',
      areaTypeCount: 2,
      roadAddress: null,
    });
    expect(byName.get('신대중흥S-클래스')).toMatchObject({
      action: 'CREATE',
      emdName: '해룡면 신대리',
      emdCode: '12150310',
    });
    expect(done.preview?.needsLocationItems).toEqual([
      expect.objectContaining({ name: '왕지현대', action: 'NEEDS_LOCATION', hasLocation: false }),
    ]);
    // only the two apartment APIs were read; the legacy code once for the empty months
    expect(new Set(fake.calls.map((c) => c.kind))).toEqual(
      new Set([TradeSyncKind.APT_TRADE, TradeSyncKind.APT_RENT]),
    );
    expect(fake.calls.some((c) => c.sggCode === '46150' && c.yearMonth === prevYm)).toBe(true);

    expect(await t.prisma.complex.count()).toBe(0);
    expect(await t.prisma.complexAreaType.count()).toBe(0);
    expect(await t.prisma.tradeRecord.count()).toBe(0);
    expect(await queue().getJobCounts('waiting', 'active')).toMatchObject({
      waiting: 0,
      active: 0,
    });
    // the latest run is reported for the screen
    const latest = await withSession(t.http().get(URL), admin).expect(200);
    expect(latest.body.item).toMatchObject({ jobId: res.body.jobId, status: 'completed' });
    const audit = await t.prisma.auditLog.findFirstOrThrow({
      where: { action: 'complex.bootstrap.preview' },
    });
    expect(audit.after).toMatchObject({ months: MONTHS, dryRun: true });
  });

  it('real run: creates 단지, then a second run creates nothing and admin edits survive', async () => {
    await runBootstrap({ months: MONTHS }); // dry run fills the month cache
    const callsAfterPreview = fake.calls.length;

    const first = await runBootstrap({ months: MONTHS, dryRun: false });
    expect(first.status).toBe('completed');
    // resumable / cheap: the real run reused the cached months
    expect(fake.calls.length).toBe(callsAfterPreview);
    expect(first.result).toEqual({
      created: 3,
      updated: 0,
      unchanged: 0,
      needsLocation: 1,
      skipped: 0,
      areaTypesCreated: 5,
      tradeSyncJobs: MONTHS,
    });
    const complexes = await t.prisma.complex.findMany({
      orderBy: { name: 'asc' },
      include: { areaTypes: { orderBy: { exclusiveArea: 'asc' } } },
    });
    expect(complexes.map((c) => [c.name, c.externalCode, c.emdCode, c.source])).toEqual([
      ['신대중흥S-클래스', '12150-9', '12150310', ComplexDataSource.TRADE_BOOTSTRAP],
      ['연향부영3차', '12150-1001', '12150114', ComplexDataSource.TRADE_BOOTSTRAP],
      ['조례현대', '12150-2002', '12150133', ComplexDataSource.TRADE_BOOTSTRAP],
    ]);
    const buyoung = complexes[1]!;
    expect(buyoung).toMatchObject({
      assetType: 'APT',
      sggCode: '12150',
      emdName: '연향동',
      jibun: '1234-5',
      jibunAddress: '순천시 연향동 1234-5',
      roadAddress: '순천시 연향번영길 100',
      builtYear: 1998,
      lat: 34.9601,
      lng: 127.5208,
    });
    expect(
      buyoung.areaTypes.map((a) => [a.exclusiveArea.toNumber(), a.typeName, a.source]),
    ).toEqual([
      [59.84, '59', ComplexDataSource.TRADE_BOOTSTRAP],
      [84.97, '84', ComplexDataSource.TRADE_BOOTSTRAP],
    ]);
    const applied = await t.prisma.auditLog.findFirstOrThrow({
      where: { action: 'complex.bootstrap.apply' },
    });
    expect(applied.after).toMatchObject({ created: 3, createdIds: expect.any(Array) });

    // admin list filter: only the auto-created ones
    const listed = await withSession(
      t.http().get('/api/v1/admin/complexes?source=TRADE_BOOTSTRAP&pageSize=50'),
      admin,
    ).expect(200);
    expect(listed.body.total).toBe(3);
    expect(listed.body.items[0]).toMatchObject({ source: 'TRADE_BOOTSTRAP' });

    // trade sync for the same months links the trades by aptSeq right away
    const jobs = await drain();
    expect(jobs).toEqual(expect.arrayContaining([TRADE_SYNC_JOBS.REMATCH, TRADE_SYNC_JOBS.MONTH]));
    const trades = await t.prisma.tradeRecord.findMany({ where: { dealYm: toYm } });
    expect(trades.length).toBe(7);
    const linked = trades.filter((r) => r.complexId === buyoung.id);
    expect(linked).toHaveLength(4);
    expect(linked.every((r) => r.areaTypeId !== null)).toBe(true);
    expect(trades.find((r) => r.aptName === '왕지현대')?.complexId).toBeNull();

    // an admin edits a bootstrapped 단지 …
    await withSession(t.http().patch(`/api/v1/admin/complexes/${buyoung.id}`), admin)
      .send({ name: '연향부영 3차 (관리자)', roadAddress: '순천시 고친길 1', builtYear: 1999 })
      .expect(200);
    await t.prisma.complex.update({
      where: { id: complexes[2]!.id },
      data: { jibunAddress: null },
    });
    await drain();

    // … the next run finds every 단지 again by externalCode, creates nothing, keeps the edits
    const second = await runBootstrap({ months: MONTHS, dryRun: false });
    expect(second.result).toMatchObject({ created: 0, updated: 1, unchanged: 2, needsLocation: 1 });
    // every month was synced after the first run: rematch only, no extra data.go.kr calls
    expect(second.result?.tradeSyncJobs).toBe(0);
    expect(await t.prisma.complex.count()).toBe(3);
    expect(await t.prisma.complexAreaType.count()).toBe(5);
    const edited = await t.prisma.complex.findUniqueOrThrow({ where: { id: buyoung.id } });
    expect(edited).toMatchObject({
      name: '연향부영 3차 (관리자)',
      roadAddress: '순천시 고친길 1',
      builtYear: 1999,
    });
    // an emptied field is filled in again
    const refilled = await t.prisma.complex.findUniqueOrThrow({ where: { id: complexes[2]!.id } });
    expect(refilled.jibunAddress).toBe('순천시 조례동 1700');
  });

  it('never recreates a 단지 an admin deleted and fills an admin-made 단지 by name', async () => {
    const adminMade = await t.prisma.complex.create({
      data: {
        name: '연향 부영3차',
        sggCode: '12150',
        emdCode: '12150114',
        lat: 34.96,
        lng: 127.52,
        households: 600,
      },
    });
    await t.prisma.complex.create({
      data: {
        name: '조례현대',
        sggCode: '12150',
        emdCode: '12150133',
        emdName: '조례동',
        lat: 34.95,
        lng: 127.53,
        deletedAt: new Date(),
      },
    });
    const run = await runBootstrap({ months: MONTHS, dryRun: false });
    expect(run.result).toMatchObject({ created: 1, updated: 1, skipped: 1, needsLocation: 1 });
    expect(run.preview?.skippedItems).toEqual([
      expect.objectContaining({ name: '조례현대', reason: '관리자가 삭제한 단지예요' }),
    ]);
    const filled = await t.prisma.complex.findUniqueOrThrow({
      where: { id: adminMade.id },
      include: { areaTypes: true },
    });
    expect(filled).toMatchObject({
      name: '연향 부영3차',
      households: 600,
      source: ComplexDataSource.ADMIN,
      externalCode: '12150-1001',
      jibun: '1234-5',
      roadAddress: '순천시 연향번영길 100',
    });
    expect(filled.areaTypes).toHaveLength(2);
    expect(await t.prisma.complex.count({ where: { deletedAt: null } })).toBe(2);
  });

  it('stops at the daily quota without retrying and resumes from the cached months', async () => {
    fake.fail(TradeSyncKind.APT_RENT, prevYm, quotaError());
    const failed = await runBootstrap({ months: MONTHS });
    expect(failed.status).toBe('failed');
    expect(failed.failedReason).toBe(BOOTSTRAP_QUOTA_MESSAGE);
    const rentCalls = fake.calls.filter(
      (c) => c.kind === TradeSyncKind.APT_RENT && c.yearMonth === prevYm,
    );
    expect(rentCalls).toHaveLength(1); // no retries against a used-up quota

    fake.clearFailures();
    fake.calls.length = 0;
    const resumed = await runBootstrap({ months: MONTHS });
    expect(resumed.status).toBe('completed');
    expect(resumed.preview?.toCreate).toBe(3);
    // only the month that failed and the ones after it are read again
    expect(fake.calls.every((c) => c.yearMonth >= prevYm)).toBe(true);
  });

  it('does not add back a 평형 an admin deleted or edited', async () => {
    await runBootstrap({ months: MONTHS, dryRun: false });
    const buyoung = await t.prisma.complex.findFirstOrThrow({
      where: { externalCode: '12150-1001' },
      include: { areaTypes: { orderBy: { exclusiveArea: 'asc' } } },
    });
    expect(buyoung.areaTypes).toHaveLength(2);
    await withSession(
      t
        .http()
        .delete(`/api/v1/admin/complexes/${buyoung.id}/area-types/${buyoung.areaTypes[0]!.id}`),
      admin,
    ).expect(204);
    await drain();
    const again = await runBootstrap({ months: MONTHS, dryRun: false });
    expect(again.status).toBe('completed');
    const after = await t.prisma.complexAreaType.findMany({ where: { complexId: buyoung.id } });
    expect(after.map((a) => [a.exclusiveArea.toNumber(), a.source])).toEqual([
      [84.97, ComplexDataSource.ADMIN],
    ]);
  });

  it('is limited to admins, validates input and needs both API keys', async () => {
    const op = await adminSession(t, AdminRole.OPERATOR);
    await start({ months: MONTHS }, op).expect(403);
    await start({ months: 6 }).expect(400);
    await start({ months: 241 }).expect(400);
    await withSession(t.http().get(`${URL}/bootstrap.123`), op).expect(404);
    await withSession(t.http().get(`${URL}/month.1`), op).expect(400);
    await t.http().get(URL).expect(401);
    geo.configured = false;
    const res = await start({ months: MONTHS }).expect(503);
    expect(res.body.code).toBe('COMPLEX_BOOTSTRAP_NOT_CONFIGURED');
  });
});
