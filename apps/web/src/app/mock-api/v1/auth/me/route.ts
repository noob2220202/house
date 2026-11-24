import type { NextRequest } from 'next/server';
import { mockGuard, mockJson, mockSessionRole, mockUnauthenticated } from '@/lib/mock';
import { mockMe } from '../_state';

// GET /api/v1/auth/me — `MeResponse` of the signed-in member, 401 when signed out.
// Profile edits made through the /me mocks (nickname, phone, marketing consent) are reflected, and
// `pendingRequiredTerms` follows the mock consents (see ../_state.ts).
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const role = mockSessionRole(req);
  if (!role) return mockUnauthenticated();
  return mockJson(mockMe(role));
}
