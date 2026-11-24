import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockUnauthenticated,
} from '@/lib/mock';
import { CSRF_FAIL, MOCK_TOTP_SECRET, mockActorEmail, mockOtpauthUrl } from '../../_mcore';

/**
 * POST /api/v1/admin/auth/totp/setup → { secret, otpauthUrl }
 * Issues a fresh TOTP secret for the admin on this session (first enrolment after the password
 * step, or re-enrolment from the account page). It only takes effect after /totp/verify.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 250);
  const email = mockActorEmail(req);
  if (!email) return mockUnauthenticated();
  return mockJson({ secret: MOCK_TOTP_SECRET, otpauthUrl: mockOtpauthUrl(email) });
}
