import type { MockComplex, MockTradeSyncRun } from './fixtures-complexes';
import { db } from './store';

/** List row of GET /admin/complexes: shared `AdminComplexListItem` (ComplexSummary + code). */
export function complexSummary(c: MockComplex) {
  return {
    id: c.id,
    name: c.name,
    assetType: c.assetType,
    roadAddress: c.roadAddress,
    jibunAddress: c.jibunAddress,
    sggCode: c.sggCode,
    emdCode: c.emdCode,
    emdName: c.emdName,
    lat: c.lat,
    lng: c.lng,
    households: c.households,
    buildings: c.buildings,
    builtYear: c.builtYear,
    approvalDate: c.approvalDate,
    activeListingCount: c.activeListingCount,
    favoriteCount: c.favoriteCount,
    viewCount: c.viewCount,
    externalCode: c.externalCode,
    source: c.source ?? 'ADMIN',
    deletedAt: null,
  };
}

/** Shared `ComplexPhotoView[]` (display order) — detail `photos` and the PUT …/photos answer. */
export function complexPhotoViews(c: MockComplex) {
  return [...c.photos]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p, i) => ({
      mediaId: p.mediaId,
      thumbUrl: p.url,
      mediumUrl: p.url,
      largeUrl: p.url,
      caption: p.caption,
      sortOrder: i,
    }));
}

/** GET /admin/complexes/:id */
export function complexDetail(c: MockComplex) {
  const { tradeTotal, tradeUnmatched, ...rest } = c;
  return {
    ...rest,
    source: c.source ?? 'ADMIN',
    areaTypeCount: c.areaTypes.length,
    photoCount: c.photos.length,
    photos: complexPhotoViews(c),
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
