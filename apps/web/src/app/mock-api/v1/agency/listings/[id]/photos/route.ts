import { MAX_LISTING_PHOTOS } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { getMedia, toMediaDto } from '../../../../media/_store';
import {
  findListing,
  isMine,
  isPrimaryMine,
  listingNotFound,
  listingsContext,
  notMember,
  readJson,
  toView,
  validationError,
} from '../../_store';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  photos: z.array(
    z.object({
      mediaId: z.string().min(1),
      caption: z.string().trim().max(100).optional(),
      isCover: z.boolean().default(false),
    }),
  ),
});

/**
 * PUT /api/v1/agency/listings/:id/photos — replaces the ordered photo list. Body (assumed)
 * `{ photos: [{ mediaId, caption?, isCover }] }`; array order = sortOrder, exactly one cover
 * (defaults to the first). 422 `LISTING_PHOTO_LIMIT` above MAX_LISTING_PHOTOS.
 */
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 300);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (!isPrimaryMine(listing)) return notMember();
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const { photos } = parsed.data;
  if (photos.length > MAX_LISTING_PHOTOS) {
    return mockError(422, 'LISTING_PHOTO_LIMIT', '등록 가능한 사진 수를 초과했습니다.');
  }
  const coverIndex = Math.max(
    0,
    photos.findIndex((p) => p.isCover),
  );
  const next = [];
  for (const [i, p] of photos.entries()) {
    const existing = listing.photos.find((x) => x.mediaId === p.mediaId);
    const media = existing ? null : getMedia(p.mediaId);
    const dto = media ? toMediaDto(media) : null;
    const url = existing?.url ?? dto?.variants.medium?.url;
    if (!url) {
      return validationError([
        { path: ['photos', i, 'mediaId'], message: '사용할 수 없는 사진입니다. 다시 올려 주세요.' },
      ]);
    }
    next.push({
      id: existing?.id ?? `photo-${p.mediaId}`,
      mediaId: p.mediaId,
      url,
      thumbUrl: existing?.thumbUrl ?? dto?.variants.thumb?.url ?? url,
      caption: p.caption ?? null,
      isCover: i === coverIndex,
    });
  }
  listing.photos = next;
  listing.updatedAt = new Date().toISOString();
  return mockJson(toView(listing));
}
