import type { NextRequest } from 'next/server';
import { mockBootstrapView } from '@/features/m-content/mock/bootstrap';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import { db } from '@/features/m-content/mock/store';
import { mockError, mockJson } from '@/lib/mock';

// GET /api/v1/admin/complexes/bootstrap/:jobId → ComplexBootstrapJobView.
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { jobId } = await params;
  if (!/^bootstrap\.\d{1,16}$/.test(jobId))
    return mockError(400, 'VALIDATION_FAILED', '작업 ID 형식이 올바르지 않습니다.');
  const job = db().bootstrapJobs.find((j) => j.jobId === jobId);
  if (!job)
    return mockError(
      404,
      'COMPLEX_BOOTSTRAP_JOB_NOT_FOUND',
      '단지 자동 생성 작업을 찾을 수 없습니다.',
    );
  return mockJson(mockBootstrapView(job));
}
