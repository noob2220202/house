import type { NextRequest } from 'next/server';
import { tradeSyncInputSchema } from '@/features/m-content/api/inputs';
import { settleRuns } from '@/features/m-content/mock/complex-view';
import type { MockTradeSyncRun } from '@/features/m-content/mock/fixtures-complexes';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson } from '@/lib/mock';

// POST /api/v1/admin/complexes/trade-sync { yearMonth } → 202 { jobId, kind, state } like the API
// (the mock also records one RUNNING run per kind so the runs list shows progress).
// The body/response shapes are ASSUMED; the path is in the complexes README.
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, tradeSyncInputSchema);
  if (isResponse(input)) return input;
  const now = new Date();
  const currentYm = now.getFullYear() * 100 + now.getMonth() + 1;
  if (input.yearMonth > currentYm)
    return mockConflict('TRADE_SYNC_FUTURE_MONTH', '아직 오지 않은 달은 동기화할 수 없습니다.');
  if (settleRuns().some((r) => r.status === 'RUNNING'))
    return mockConflict('TRADE_SYNC_ALREADY_RUNNING', '이미 진행 중인 동기화가 있습니다.');
  const seed = input.yearMonth % 97;
  const make = (kind: MockTradeSyncRun['kind'], base: number): MockTradeSyncRun => ({
    id: newId(),
    kind,
    sggCode: '12150',
    yearMonth: input.yearMonth,
    status: 'RUNNING',
    fetchedCount: 0,
    upsertedCount: 0,
    matchedCount: 0,
    error: null,
    startedAt: nowIso(),
    finishedAt: null,
    triggeredByAdminName: ctx.actor.name,
    settle: { fetched: base + seed * 3, upserted: 6 + (seed % 9), matched: 5 + (seed % 9) },
  });
  const runs = [make('APT_TRADE', 380), make('APT_RENT', 820)];
  db().syncRuns.unshift(...runs.slice().reverse());
  audit(ctx, req, {
    action: 'complex.trade_sync.trigger',
    resourceType: 'TradeSyncRun',
    resourceId: runs[0]?.id ?? null,
    resourceLabel: `${Math.floor(input.yearMonth / 100)}년 ${input.yearMonth % 100}월 실거래가`,
    after: { yearMonth: input.yearMonth, kinds: runs.map((r) => r.kind) },
  });
  return mockJson(
    { jobId: `mock-sync-${runs[0]?.id ?? 'job'}`, kind: 'MONTH', state: 'waiting' },
    { status: 202 },
  );
}
