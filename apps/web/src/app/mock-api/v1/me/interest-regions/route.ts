import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { authState } from '../../auth/_state';
import { meGuard, mockForcedFailure } from '../_store';

// Owned by the w-auth page group. ASSUMED endpoint (docs/frontend-integration/w-auth.md).

const bodySchema = z.object({
  regionKeys: z.array(z.string().min(1).max(40)).max(5),
  notify: z.boolean(),
});

// GET /api/v1/me/interest-regions → { regionKeys, notify }
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const { regionKeys, notify } = authState(g.role);
  return mockJson({ regionKeys, notify });
}

// PUT /api/v1/me/interest-regions — replaces the selection (max 5).
export async function PUT(req: NextRequest) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    );
  const state = authState(g.role);
  state.regionKeys = [...new Set(parsed.data.regionKeys)];
  state.notify = parsed.data.notify;
  return mockJson({ regionKeys: state.regionKeys, notify: state.notify });
}
