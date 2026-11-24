import { PopupPage, popupServeQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { POPUPS, isPopupLive, servePopup } from './_fixtures';

// GET /api/v1/popups?page — public; live popups targeting the page (or ALL), ordered (ads module).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const parsed = popupServeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const { page } = parsed.data;
  const items = POPUPS.filter(
    (p) =>
      isPopupLive(p) && (p.targetPages.includes(PopupPage.ALL) || p.targetPages.includes(page)),
  )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(servePopup);
  return mockJson({ items });
}
