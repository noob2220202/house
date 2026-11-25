import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  isMockBootstrapRunning,
  mockBootstrapView,
  startMockBootstrap,
} from '@/features/m-content/mock/bootstrap';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson } from '@/lib/mock';

// Same bounds as shared `complexBootstrapRequestSchema`.
const bodySchema = z.object({
  months: z.number().int().min(12).max(240).default(60),
  dryRun: z.boolean().default(true),
});

// GET /api/v1/admin/complexes/bootstrap → { item: ComplexBootstrapJobView | null } (latest run).
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const latest = db().bootstrapJobs[0];
  return mockJson({ item: latest ? mockBootstrapView(latest) : null });
}

// POST /api/v1/admin/complexes/bootstrap { months, dryRun } → 202 ComplexBootstrapAccepted.
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, bodySchema);
  if (isResponse(input)) return input;
  if (isMockBootstrapRunning(db().bootstrapJobs[0]))
    return mockConflict(
      'COMPLEX_BOOTSTRAP_IN_PROGRESS',
      '단지 자동 생성 작업이 이미 진행 중입니다.',
    );
  const job = startMockBootstrap(input.months, input.dryRun);
  audit(ctx, req, {
    action: input.dryRun ? 'complex.bootstrap.preview' : 'complex.bootstrap.run',
    resourceType: 'Complex',
    resourceLabel: `실거래가로 단지 만들기 (${input.months}개월)`,
    after: { months: input.months, dryRun: input.dryRun, jobId: job.jobId },
  });
  return mockJson(
    { jobId: job.jobId, state: 'waiting', dryRun: job.dryRun, months: job.months },
    { status: 202 },
  );
}
