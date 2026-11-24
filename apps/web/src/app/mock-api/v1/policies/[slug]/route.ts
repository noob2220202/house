import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { MOCK_POLICIES } from '../_fixtures';

// GET /api/v1/policies/:slug — ASSUMED (w-content): operating policy page edited in the back-office.
// → { slug, title, version, effectiveAt, content }; 404 POLICY_NOT_FOUND until one is published.
// `?_empty=1` answers 404 (the page's "준비 중" state).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const { slug } = await params;
  const policy = MOCK_POLICIES.find((p) => p.slug === slug);
  if (!policy || req.nextUrl.searchParams.get('_empty') === '1') {
    return mockError(404, 'POLICY_NOT_FOUND', '정책 문서를 찾을 수 없습니다.');
  }
  return mockJson(policy);
}
