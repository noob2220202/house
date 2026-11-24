import { bannerServeQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { BANNERS, isLive, serveBanner } from './_fixtures';

// GET /api/v1/banners?slot&regionCode&complexId — public; only banners that are live right now,
// ordered by sortOrder, capped by the slot's maxActive (ads module).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const parsed = bannerServeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const items = BANNERS.filter((b) => b.slot === parsed.data.slot && isLive(b))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(serveBanner);
  return mockJson({ items });
}
