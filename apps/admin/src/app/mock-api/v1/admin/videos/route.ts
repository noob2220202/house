import { parseYoutubeVideoId } from '@house/shared';
import type { NextRequest } from 'next/server';
import { videoCreateBodySchema } from '@/features/m-content/api/inputs';
import { isResponse, matchesText, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db, withComplexName } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

// GET /api/v1/admin/videos?q&page&pageSize — ordered by sortOrder
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const rows = db()
    .videos.filter((v) => matchesText(sp.get('q'), v.title, v.description))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(withComplexName);
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req, { pageSize: 100 }));
}

// POST /api/v1/admin/videos (localVideoInputSchema) — new videos go to the top
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  // Same schema as the backend (localVideoInputSchema): empty optional fields must be left out.
  const input = await mockBody(req, videoCreateBodySchema);
  if (isResponse(input)) return input;
  const store = db();
  const videoId = parseYoutubeVideoId(input.youtubeUrl) ?? '';
  const now = nowIso();
  store.videos.forEach((v) => {
    v.sortOrder += 1;
  });
  const row = {
    id: newId(),
    title: input.title,
    youtubeUrl: input.youtubeUrl,
    youtubeVideoId: videoId,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: input.description?.trim() || null,
    regionCode: input.regionCode || null,
    complexId: input.complexId || null,
    sortOrder: 1,
    isPublished: input.isPublished,
    publishedAt: input.isPublished ? now : null,
    updatedAt: now,
  };
  store.videos.unshift(row);
  audit(ctx, req, {
    action: 'video.create',
    resourceType: 'LocalVideo',
    resourceId: row.id,
    resourceLabel: row.title,
    after: { title: row.title, youtubeVideoId: videoId, isPublished: row.isPublished },
  });
  return mockJson(withComplexName(row), { status: 201 });
}
