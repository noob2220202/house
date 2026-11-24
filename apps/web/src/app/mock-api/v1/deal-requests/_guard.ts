import type { NextRequest, NextResponse } from 'next/server';
import { mockCsrfOk, mockError, mockGuard, mockSessionRole, mockUnauthenticated } from '@/lib/mock';

/** Common preamble of the owner-only deal-request handlers: mock flag, session, CSRF on mutations. */
export function ownerGuard(
  req: NextRequest,
  opts: { mutation?: boolean } = {},
): NextResponse | null {
  const off = mockGuard();
  if (off) return off;
  if (!mockSessionRole(req)) return mockUnauthenticated();
  if (opts.mutation && !mockCsrfOk(req))
    return mockError(403, 'CSRF_FAILED', '보안 토큰이 올바르지 않습니다.');
  return null;
}

export const requestNotFound = () =>
  mockError(404, 'DEAL_REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다.');
export const requestClosed = () => mockError(409, 'DEAL_REQUEST_CLOSED', '종료된 요청입니다.');
export const proposalNotFound = () =>
  mockError(404, 'PROPOSAL_NOT_FOUND', '제안을 찾을 수 없습니다.');
