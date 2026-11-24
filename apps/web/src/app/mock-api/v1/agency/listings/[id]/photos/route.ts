import { MAX_LISTING_PHOTOS, listingPhotosSchema } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
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
  validationError,
} from '../../_store';

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/v1/agency/listings/:id/photos — replaces the ordered photo list. Body
 * `listingPhotosSchema`: `{ photos: [{ mediaId, caption? }], coverMediaId? }`; array order =
 * sortOrder, the cover defaults to the first photo. Answers with the saved photos (`PhotoUrls[]`).
 */
export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const ctx = listingsContext(req, { mutation: true });
  if ('status' in ctx) return ctx;
  await mockDelay(req, 300);
  const listing = findListing(ctx.state, (await params).id);
  if (!listing || !isMine(listing)) return listingNotFound();
  if (!isPrimaryMine(listing)) return notMember();
  const parsed = listingPhotosSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const { photos, coverMediaId } = parsed.data;
  if (photos.length > MAX_LISTING_PHOTOS) {
    return mockError(400, 'LISTING_PHOTO_LIMIT', '등록 가능한 사진 수를 초과했습니다.');
  }
  const coverIndex = Math.max(
    0,
    photos.findIndex((p) => p.mediaId === coverMediaId),
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
  listing.version = (listing.version ?? 0) + 1;
  return mockJson(
    next.map((p) => ({
      mediaId: p.mediaId,
      thumbUrl: p.thumbUrl,
      mediumUrl: p.url,
      largeUrl: p.url,
      caption: p.caption,
      isCover: p.isCover,
    })),
  );
}
