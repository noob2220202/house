import { TermsType } from '@house/shared';
import type { NextRequest } from 'next/server';
import { termsInputSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db, termsView } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

const TYPE_ORDER: readonly string[] = Object.values(TermsType);

// GET /api/v1/admin/terms?type&page&pageSize — every version incl. drafts, newest first per type
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'ADMIN' });
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const type = sp.get('type');
  const rows = db()
    .terms.filter((t) => !type || t.type === type)
    .sort(
      (a, b) =>
        TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
        b.effectiveAt.localeCompare(a.effectiveAt),
    )
    .map(termsView)
    .map(({ content: _content, ...rest }) => rest);
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req, { pageSize: 100 }));
}

// POST /api/v1/admin/terms (termsDocumentInputSchema) → a draft (publishedAt = null)
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, termsInputSchema);
  if (isResponse(input)) return input;
  const store = db();
  if (store.terms.some((t) => t.type === input.type && t.version === input.version))
    return mockConflict('TERMS_VERSION_EXISTS', '같은 버전의 약관이 이미 있습니다.');
  const now = nowIso();
  const row = {
    id: newId(),
    ...input,
    publishedAt: null,
    consentCount: null,
    createdAt: now,
    updatedAt: now,
  };
  store.terms.unshift(row);
  audit(ctx, req, {
    action: 'terms.create',
    resourceType: 'TermsDocument',
    resourceId: row.id,
    resourceLabel: `${row.title} ${row.version}`,
    after: {
      type: row.type,
      version: row.version,
      isRequired: row.isRequired,
      effectiveAt: row.effectiveAt,
    },
  });
  return mockJson(termsView(row), { status: 201 });
}
