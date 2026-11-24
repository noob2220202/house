import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { identitySummaries } from '../../auth/_state';
import { meGuard, mockForcedFailure } from '../_store';

// GET /api/v1/me/identities — `IdentitySummary[]` `{ provider, email, linkedAt, lastUsedAt }`.
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  return mockJson(identitySummaries(g.role));
}
