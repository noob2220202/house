import { FaqCategory } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { FAQS } from './_fixtures';

// GET /api/v1/faqs?category — published FAQs ordered by category, sortOrder. Public (admin module).
// ASSUMED: returned as one bare list (the set is small). `?_empty=1` returns no items (dev).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category');
  const valid = (Object.values(FaqCategory) as string[]).includes(category ?? '');
  const items = sp.has('_empty')
    ? []
    : FAQS.filter((f) => !valid || f.category === category).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
  return mockJson(items);
}
