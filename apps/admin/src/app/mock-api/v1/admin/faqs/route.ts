import { FaqCategory } from '@house/shared';
import type { NextRequest } from 'next/server';
import { faqFormSchema } from '@/features/m-content/api/inputs';
import { isResponse, matchesText, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

const CATEGORY_ORDER = Object.values(FaqCategory) as string[];

// GET /api/v1/admin/faqs?category&q&page&pageSize — ordered by category, then sortOrder
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const category = sp.get('category');
  const rows = db()
    .faqs.filter((f) => !category || f.category === category)
    .filter((f) => matchesText(sp.get('q'), f.question, f.answer))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.sortOrder - b.sortOrder,
    );
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req, { pageSize: 100 }));
}

// POST /api/v1/admin/faqs (faqInputSchema) — appended to the end of its category
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, faqFormSchema);
  if (isResponse(input)) return input;
  const store = db();
  const last = Math.max(
    0,
    ...store.faqs.filter((f) => f.category === input.category).map((f) => f.sortOrder),
  );
  const row = { id: newId(), ...input, sortOrder: last + 1, updatedAt: nowIso() };
  store.faqs.push(row);
  audit(ctx, req, {
    action: 'faq.create',
    resourceType: 'Faq',
    resourceId: row.id,
    resourceLabel: row.question,
    after: { category: row.category, question: row.question, isPublished: row.isPublished },
  });
  return mockJson(row, { status: 201 });
}
