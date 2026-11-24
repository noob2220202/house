import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { MOCK_TERMS } from './_fixtures';

// GET /api/v1/terms — current (effective) document of every type, without content. Public.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  if (req.nextUrl.searchParams.get('_fail') === '1')
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  return mockJson({
    items: MOCK_TERMS.map((doc) => ({
      id: doc.id,
      type: doc.type,
      version: doc.version,
      title: doc.title,
      isRequired: doc.isRequired,
      effectiveAt: doc.effectiveAt,
    })),
  });
}
