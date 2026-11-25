import type { MockAreaType, MockComplex } from './fixtures-complexes';
import { newId, nowIso } from './ids';
import { db } from './store';

/**
 * MOCK ONLY: 실거래가로 단지 만들기 (POST/GET /admin/complexes/bootstrap). A run "takes" ~6 s
 * (progress derived from the clock so the polling UI can be exercised); a finished real run adds
 * its new 단지 to the mock store once (source TRADE_BOOTSTRAP), so a second run creates nothing.
 */

type Action = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'NEEDS_LOCATION' | 'SKIP';

interface Candidate {
  name: string;
  emdName: string;
  emdCode: string;
  jibun: string;
  road: string | null;
  builtYear: number;
  areas: number[];
  externalCode: string;
  lat: number;
  lng: number;
  hasLocation: boolean;
  sale: number;
  rent: number;
}

/** Fictional 단지 the mock "finds" in the 실거래 data. */
const POOL: Candidate[] = [
  {
    name: '연향 햇살마을',
    emdName: '연향동',
    emdCode: '12150114',
    jibun: '1402',
    road: '연향번영길 21',
    builtYear: 2004,
    areas: [59.97, 84.93],
    externalCode: '12150-9101',
    lat: 34.9427,
    lng: 127.5172,
    hasLocation: true,
    sale: 182,
    rent: 240,
  },
  {
    name: '조례 은행나무',
    emdName: '조례동',
    emdCode: '12150133',
    jibun: '1611',
    road: null,
    builtYear: 1997,
    areas: [49.8, 59.4],
    externalCode: '12150-9102',
    lat: 34.9541,
    lng: 127.5302,
    hasLocation: true,
    sale: 96,
    rent: 131,
  },
  {
    name: '왕지 푸른언덕',
    emdName: '왕지동',
    emdCode: '12150132',
    jibun: '855',
    road: '왕지로 40',
    builtYear: 2012,
    areas: [74.9, 84.96, 101.8],
    externalCode: '12150-9103',
    lat: 34.9662,
    lng: 127.5266,
    hasLocation: true,
    sale: 74,
    rent: 58,
  },
  {
    name: '용당 시민아파트',
    emdName: '용당동',
    emdCode: '12150110',
    jibun: '322',
    road: null,
    builtYear: 1989,
    areas: [39.6, 49.5],
    externalCode: '12150-9104',
    lat: 34.9688,
    lng: 127.4993,
    hasLocation: true,
    sale: 41,
    rent: 67,
  },
  {
    name: '풍덕 강변마을',
    emdName: '풍덕동',
    emdCode: '12150115',
    jibun: '1290',
    road: '풍덕로 8',
    builtYear: 2008,
    areas: [84.97],
    externalCode: '12150-9105',
    lat: 34.9395,
    lng: 127.4991,
    hasLocation: true,
    sale: 63,
    rent: 49,
  },
  {
    name: '해룡 들녘마을',
    emdName: '해룡면 신대리',
    emdCode: '12150310',
    jibun: '2001',
    road: '신대1로 77',
    builtYear: 2018,
    areas: [59.99, 84.99, 99.9],
    externalCode: '12150-9106',
    lat: 34.9318,
    lng: 127.5597,
    hasLocation: true,
    sale: 211,
    rent: 152,
  },
  {
    name: '덕월 소망',
    emdName: '덕월동',
    emdCode: '12150127',
    jibun: '410',
    road: null,
    builtYear: 1994,
    areas: [59.8],
    externalCode: '12150-9107',
    lat: 34.9621,
    lng: 127.5044,
    hasLocation: true,
    sale: 22,
    rent: 30,
  },
  {
    name: '매곡 산마루',
    emdName: '매곡동',
    emdCode: '12150107',
    jibun: '133-2',
    road: null,
    builtYear: 1992,
    areas: [49.9, 59.9],
    externalCode: '12150-9108',
    lat: 34.9647,
    lng: 127.4837,
    hasLocation: false,
    sale: 11,
    rent: 9,
  },
  {
    name: '서면 새마을주택',
    emdName: '서면 선평리',
    emdCode: '12150320',
    jibun: '501',
    road: null,
    builtYear: 1991,
    areas: [44.6],
    externalCode: '12150-9109',
    lat: 0,
    lng: 0,
    hasLocation: false,
    sale: 4,
    rent: 2,
  },
];
const SKIPPED = {
  name: '어디동아파트',
  emdName: '신성리',
  reason: '서비스 지역의 법정동을 확인할 수 없어요',
};

export interface MockBootstrapJob {
  jobId: string;
  dryRun: boolean;
  months: number;
  fromYm: number;
  toYm: number;
  createdAtMs: number;
  /** Real runs: the store was updated. */
  applied: boolean;
  /** Plan fixed when the run started. */
  items: { candidate: Candidate; action: Action; complexId: string | null }[];
  updateIds: string[];
}

const RUN_MS = { waiting: 600, fetch: 3500, geocode: 5000, write: 6000 };

function addMonths(ym: number, delta: number): number {
  const i = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(i / 12) * 100 + ((i % 12) + 1);
}

export function bootstrapRange(months: number, now = new Date()) {
  const toYm = addMonths(now.getFullYear() * 100 + now.getMonth() + 1, -1);
  return { fromYm: addMonths(toYm, -(months - 1)), toYm };
}

export function startMockBootstrap(months: number, dryRun: boolean): MockBootstrapJob {
  const store = db();
  const byCode = new Map(store.complexes.map((c) => [c.externalCode, c]));
  const items = POOL.map((candidate) => {
    const hit = byCode.get(candidate.externalCode);
    const action: Action = hit ? 'UNCHANGED' : candidate.hasLocation ? 'CREATE' : 'NEEDS_LOCATION';
    return { candidate, action, complexId: hit?.id ?? null };
  });
  // Admin-made 단지 without a 국토부 code get it (and their empty fields) filled in.
  const updateIds = store.complexes
    .filter((c) => !c.externalCode)
    .slice(0, 2)
    .map((c) => c.id);
  const now = Date.now();
  const job: MockBootstrapJob = {
    jobId: `bootstrap.${now}`,
    dryRun,
    months,
    ...bootstrapRange(months),
    createdAtMs: now,
    applied: false,
    items,
    updateIds,
  };
  store.bootstrapJobs.unshift(job);
  return job;
}

export function isMockBootstrapRunning(job: MockBootstrapJob | undefined, now = Date.now()) {
  return !!job && now - job.createdAtMs < (job.dryRun ? RUN_MS.geocode : RUN_MS.write);
}

function area(exclusiveArea: number): MockAreaType {
  return {
    id: newId(),
    exclusiveArea,
    supplyArea: null,
    typeName: String(Math.floor(exclusiveArea)),
    pyeongLabel: null,
    households: null,
    rooms: null,
    baths: null,
    tradeCount: 0,
    lastSalePrice: null,
  };
}

function apply(job: MockBootstrapJob): void {
  if (job.dryRun || job.applied) return;
  job.applied = true;
  const store = db();
  for (const item of job.items) {
    if (item.action !== 'CREATE') continue;
    const c = item.candidate;
    const now = nowIso();
    const row: MockComplex = {
      id: newId(),
      assetType: 'APT',
      name: c.name,
      roadAddress: c.road ? `순천시 ${c.road}` : null,
      jibunAddress: `순천시 ${c.emdName} ${c.jibun}`,
      sggCode: '12150',
      emdCode: c.emdCode,
      emdName: c.emdName.split(' ').at(-1) ?? c.emdName,
      jibun: c.jibun,
      lat: c.lat,
      lng: c.lng,
      households: null,
      buildings: null,
      floorsMin: null,
      floorsMax: null,
      approvalDate: null,
      builtYear: c.builtYear,
      parkingTotal: null,
      parkingPerHousehold: null,
      floorAreaRatio: null,
      buildingCoverageRatio: null,
      heatingType: null,
      builder: null,
      externalCode: c.externalCode,
      source: 'TRADE_BOOTSTRAP',
      viewCount: 0,
      favoriteCount: 0,
      activeListingCount: 0,
      lastTradeDate: null,
      tradeTotal: 0,
      tradeUnmatched: 0,
      createdAt: now,
      updatedAt: now,
      areaTypes: c.areas.map((a) => area(a)),
      photos: [],
    };
    store.complexes.unshift(row);
    item.complexId = row.id;
  }
  for (const [i, id] of job.updateIds.entries()) {
    const c = store.complexes.find((x) => x.id === id);
    if (c && !c.externalCode) c.externalCode = `12150-98${String(i).padStart(2, '0')}`;
  }
}

function item(i: MockBootstrapJob['items'][number]) {
  const c = i.candidate;
  return {
    action: i.action,
    reason: i.action === 'NEEDS_LOCATION' ? '주소로 좌표를 찾지 못했어요' : null,
    name: c.name,
    emdName: c.emdName,
    emdCode: c.emdCode,
    jibunAddress: `순천시 ${c.emdName} ${c.jibun}`,
    roadAddress: c.road ? `순천시 ${c.road}` : null,
    builtYear: c.builtYear,
    areaTypeCount: c.areas.length,
    exclusiveAreas: c.areas,
    hasLocation: i.action !== 'NEEDS_LOCATION',
    externalCode: c.externalCode,
    saleCount: c.sale,
    rentCount: c.rent,
    complexId: i.complexId,
  };
}

const ORDER: Record<Action, number> = {
  CREATE: 0,
  NEEDS_LOCATION: 1,
  UPDATE: 2,
  UNCHANGED: 3,
  SKIP: 4,
};

/** Shared `ComplexBootstrapJobView` of a mock run at the current time. */
export function mockBootstrapView(job: MockBootstrapJob, now = Date.now()) {
  const elapsed = now - job.createdAtMs;
  const end = job.dryRun ? RUN_MS.geocode : RUN_MS.write;
  const done = elapsed >= end;
  if (done) apply(job);
  const steps = job.months * 2;
  const geocodeTotal = job.items.filter((i) => i.action !== 'UNCHANGED').length;
  const writeTotal = job.items.filter((i) => i.action === 'CREATE').length + job.updateIds.length;
  const frac = (from: number, to: number) =>
    Math.min(1, Math.max(0, (elapsed - from) / (to - from)));
  const progress = done
    ? { phase: 'done' as const, done: 1, total: 1, percent: 100 }
    : elapsed < RUN_MS.waiting
      ? { phase: 'queued' as const, done: 0, total: 0, percent: 0 }
      : elapsed < RUN_MS.fetch
        ? {
            phase: 'fetch' as const,
            done: Math.round(steps * frac(RUN_MS.waiting, RUN_MS.fetch)),
            total: steps,
            percent: Math.round(50 * frac(RUN_MS.waiting, RUN_MS.fetch)),
          }
        : elapsed < RUN_MS.geocode
          ? {
              phase: 'geocode' as const,
              done: Math.round(geocodeTotal * frac(RUN_MS.fetch, RUN_MS.geocode)),
              total: geocodeTotal,
              percent: Math.round(50 + 35 * frac(RUN_MS.fetch, RUN_MS.geocode)),
            }
          : {
              phase: 'write' as const,
              done: Math.round(writeTotal * frac(RUN_MS.geocode, RUN_MS.write)),
              total: writeTotal,
              percent: Math.round(85 + 15 * frac(RUN_MS.geocode, RUN_MS.write)),
            };
  const items = job.items.map(item);
  const updates = job.updateIds.flatMap((id) => {
    const c = db().complexes.find((x) => x.id === id);
    return c
      ? [
          {
            ...item({
              candidate: {
                ...POOL[0]!,
                name: c.name,
                emdName: c.emdName ?? '',
                emdCode: c.emdCode ?? '',
              },
              action: 'UPDATE',
              complexId: c.id,
            }),
            builtYear: c.builtYear,
            areaTypeCount: c.areaTypes.length,
            exclusiveAreas: c.areaTypes.map((a) => a.exclusiveArea),
            jibunAddress: c.jibunAddress,
            roadAddress: c.roadAddress,
            externalCode: c.externalCode,
          },
        ]
      : [];
  });
  const skipped = {
    ...item({
      candidate: { ...POOL[0]!, name: SKIPPED.name, emdName: SKIPPED.emdName },
      action: 'SKIP',
      complexId: null,
    }),
    reason: SKIPPED.reason,
    emdCode: null,
    jibunAddress: null,
    roadAddress: null,
    builtYear: null,
    areaTypeCount: 0,
    exclusiveAreas: [],
    hasLocation: false,
    externalCode: null,
    saleCount: 2,
    rentCount: 0,
  };
  const all = [...items, ...updates, skipped].sort(
    (a, b) =>
      ORDER[a.action] - ORDER[b.action] || b.saleCount + b.rentCount - (a.saleCount + a.rentCount),
  );
  const count = (a: Action) => all.filter((i) => i.action === a).length;
  const planned = elapsed >= RUN_MS.geocode;
  const preview = planned
    ? {
        fromYm: job.fromYm,
        toYm: job.toYm,
        rows:
          all.reduce((n, i) => n + i.saleCount + i.rentCount, 0) *
          Math.max(1, Math.round(job.months / 12)),
        candidates: all.length,
        toCreate: count('CREATE'),
        toUpdate: count('UPDATE'),
        unchanged: count('UNCHANGED'),
        needsLocation: count('NEEDS_LOCATION'),
        skipped: count('SKIP'),
        sample: all.slice(0, 50),
        needsLocationItems: all.filter((i) => i.action === 'NEEDS_LOCATION'),
        skippedItems: all.filter((i) => i.action === 'SKIP'),
      }
    : null;
  return {
    jobId: job.jobId,
    status: done ? 'completed' : elapsed < RUN_MS.waiting ? 'waiting' : 'active',
    dryRun: job.dryRun,
    months: job.months,
    fromYm: job.fromYm,
    toYm: job.toYm,
    progress,
    preview,
    result:
      done && !job.dryRun
        ? {
            created: count('CREATE'),
            updated: count('UPDATE'),
            unchanged: count('UNCHANGED'),
            needsLocation: count('NEEDS_LOCATION'),
            skipped: count('SKIP'),
            areaTypesCreated: job.items
              .filter((i) => i.action === 'CREATE')
              .reduce((n, i) => n + i.candidate.areas.length, 0),
            tradeSyncJobs: count('CREATE') + count('UPDATE') > 0 ? job.months : 0,
          }
        : null,
    failedReason: null,
    createdAt: new Date(job.createdAtMs).toISOString(),
    finishedAt: done ? new Date(job.createdAtMs + end).toISOString() : null,
  };
}
