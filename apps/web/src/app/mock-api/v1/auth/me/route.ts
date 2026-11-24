import type { NextRequest } from 'next/server';
import { mockGuard, mockJson, mockSessionRole, mockUnauthenticated } from '@/lib/mock';
import { meState } from '../../me/_store';
import { MOCK_USERS } from '../_fixtures';
import { mockSignupPending } from '../_state';

// GET /api/v1/auth/me — current user, 401 when signed out.
// Profile edits made through the /me mocks (nickname, phone, marketing consent) are reflected, and
// `signupCompleted` is false until the required terms are agreed (mock cookie, see ../_state.ts).
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const role = mockSessionRole(req);
  if (!role) return mockUnauthenticated();
  const { nickname, phone, marketingOptIn } = meState(role).profile;
  return mockJson({
    ...MOCK_USERS[role],
    nickname,
    phone: phone ?? null,
    marketingOptIn,
    signupCompleted: !mockSignupPending(req),
  });
}
