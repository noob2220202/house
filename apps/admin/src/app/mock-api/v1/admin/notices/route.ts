import type { NextRequest } from 'next/server';
import { noticeFormSchema } from '@/features/m-content/api/inputs';
import { isResponse, matchesText, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

const summary = ({ content: _content, ...rest }: ReturnType<typeof db>['notices'][number]) => rest;

// GET /api/v1/admin/notices?page&pageSize&q&status=published|draft (ASSUMED filters)
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const status = sp.get('status');
  const rows = db()
    .notices.filter((n) => matchesText(sp.get('q'), n.title, n.content))
    .filter((n) =>
      status === 'published' ? n.isPublished : status === 'draft' ? !n.isPublished : true,
    )
    .sort(
      (a, b) =>
        Number(b.isPinned && b.isPublished) - Number(a.isPinned && a.isPublished) ||
        (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
    )
    .map(summary);
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req));
}

// POST /api/v1/admin/notices (noticeInputSchema)
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, noticeFormSchema);
  if (isResponse(input)) return input;
  const now = nowIso();
  const row = {
    id: newId(),
    ...input,
    publishedAt: input.isPublished ? now : null,
    viewCount: 0,
    createdByAdminName: ctx.actor.name,
    createdAt: now,
    updatedAt: now,
  };
  db().notices.unshift(row);
  audit(ctx, req, {
    action: 'notice.create',
    resourceType: 'Notice',
    resourceId: row.id,
    resourceLabel: row.title,
    after: { title: row.title, isPinned: row.isPinned, isPublished: row.isPublished },
  });
  return mockJson(row, { status: 201 });
}
