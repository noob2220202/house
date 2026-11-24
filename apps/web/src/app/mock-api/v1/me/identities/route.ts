import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { meGuard, mockForcedFailure } from '../_store';

// GET /api/v1/me/identities — social accounts linked to the user (ASSUMED endpoint, see w-me.md).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  return mockJson({ items: g.state.identities });
}
