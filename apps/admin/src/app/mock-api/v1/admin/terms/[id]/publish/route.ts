import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin, mockConflict } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, db, termsView } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

// POST /api/v1/admin/terms/:id/publish — ASSUMED path for "publish" in the admin README.
// Publishing a REQUIRED document makes every member agree again from `effectiveAt`.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true, delay: 600 });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.terms.find((t) => t.id === id);
  if (!row) return mockNotFound('TERMS_NOT_FOUND', '약관을 찾을 수 없습니다.');
  if (row.publishedAt) return mockConflict('TERMS_ALREADY_PUBLISHED', '이미 게시된 약관입니다.');
  const previous = store.terms
    .filter((t) => t.type === row.type && t.publishedAt)
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
  if (previous && row.effectiveAt <= previous.effectiveAt)
    return mockConflict(
      'TERMS_EFFECTIVE_DATE_INVALID',
      '적용일은 현재 게시된 버전의 적용일보다 뒤여야 합니다.',
    );
  row.publishedAt = nowIso();
  row.updatedAt = row.publishedAt;
  row.consentCount = 0;
  audit(ctx, req, {
    action: 'terms.publish',
    resourceType: 'TermsDocument',
    resourceId: id,
    resourceLabel: `${row.title} ${row.version}`,
    before: { publishedAt: null },
    after: { publishedAt: row.publishedAt, effectiveAt: row.effectiveAt },
  });
  return mockJson({
    ...termsView(row),
    reconsentUserCount: row.isRequired ? (previous?.consentCount ?? 0) : 0,
  });
}
