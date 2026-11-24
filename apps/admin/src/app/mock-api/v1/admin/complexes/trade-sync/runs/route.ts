import type { NextRequest } from 'next/server';
import { publicRun, settleRuns } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import { mockJson, mockPaginate } from '@/lib/mock';

// GET /api/v1/admin/complexes/trade-sync/runs?status&page&pageSize — newest first
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req, { delay: 120 });
  if (isResponse(ctx)) return ctx;
  const status = ctx.sp.get('status');
  const rows = settleRuns()
    .filter((r) => !status || r.status === status)
    .map(publicRun);
  return mockJson(mockPaginate(ctx.sp.get('_empty') === '1' ? [] : rows, req, { pageSize: 10 }));
}
