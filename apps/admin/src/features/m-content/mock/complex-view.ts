import type { MockComplex, MockTradeSyncRun } from './fixtures-complexes';
import { db } from './store';

/** List row of GET /admin/complexes. */
export function complexSummary(c: MockComplex) {
  return {
    id: c.id,
    assetType: c.assetType,
    name: c.name,
    roadAddress: c.roadAddress,
    jibunAddress: c.jibunAddress,
    emdName: c.emdName,
    households: c.households,
    builtYear: c.builtYear,
    areaTypeCount: c.areaTypes.length,
    photoCount: c.photos.length,
    activeListingCount: c.activeListingCount,
    viewCount: c.viewCount,
    externalCode: c.externalCode,
    lastTradeDate: c.lastTradeDate,
    updatedAt: c.updatedAt,
  };
}

/** GET /admin/complexes/:id */
export function complexDetail(c: MockComplex) {
  const { tradeTotal, tradeUnmatched, ...rest } = c;
  return {
    ...rest,
    areaTypeCount: c.areaTypes.length,
    photoCount: c.photos.length,
    photos: [...c.photos].sort((a, b) => a.sortOrder - b.sortOrder),
    areaTypes: [...c.areaTypes].sort((a, b) => a.exclusiveArea - b.exclusiveArea),
    trades: { total: tradeTotal, unmatched: tradeUnmatched, lastDealDate: c.lastTradeDate },
  };
}

export function findComplex(id: string): MockComplex | undefined {
  return db().complexes.find((c) => c.id === id);
}

const RUN_SECONDS = 6;

/** MOCK ONLY: RUNNING runs finish ~6 s after they started (so the polling UI can be exercised). */
export function settleRuns(): MockTradeSyncRun[] {
  const runs = db().syncRuns;
  const now = Date.now();
  for (const run of runs) {
    if (run.status !== 'RUNNING' || !run.settle) continue;
    const started = new Date(run.startedAt).getTime();
    if (now - started < RUN_SECONDS * 1000) continue;
    run.status = 'SUCCEEDED';
    run.fetchedCount = run.settle.fetched;
    run.upsertedCount = run.settle.upserted;
    run.matchedCount = run.settle.matched;
    run.finishedAt = new Date(started + RUN_SECONDS * 1000).toISOString();
    delete run.settle;
  }
  return runs;
}

export const publicRun = ({ settle: _settle, ...run }: MockTradeSyncRun) => run;
