import {
  type AssetType,
  BannerSlot,
  DealType,
  ListingStatus,
  REGION_CODE_PATTERN,
} from '@house/shared';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { cache } from 'react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import {
  EMPTY_SIMILAR,
  listingDetailSchema,
  servedBannersSchema,
  similarListingsSchema,
  type ListingDetail,
  type ServedBanner,
} from '@/features/w-listing/api/schemas';
import { complexDetailSchema } from '@/features/w-complex/api/schemas';
import { ListingPage } from '@/features/w-listing/components/ListingPage';
import { withComplexDetail } from '@/features/w-listing/lib/complex';
import {
  buildBreadcrumb,
  headlineAmount,
  listingFullTitle,
  metaDescription,
  regionLine,
} from '@/features/w-listing/lib/view';
import { ApiError } from '@/lib/api';
import { serverGet, serverGetOr } from '@/lib/api/server';
import {
  JsonLd,
  SEO_ROUTES,
  assetSlugOf,
  breadcrumbJsonLd,
  buildMetadata,
  landingDecision,
  listingJsonLd,
} from '@/lib/seo';
import { getListingStatus, getSeoRegionIndex } from '@/lib/seo/api';

type Props = { params: Promise<{ id: string }> };

/**
 * ISR: listings are rendered on first request and cached for 60s (no cookies are read here — the
 * viewer-specific bits load on the client). Declaring `generateStaticParams` makes the on-demand
 * render blocking, so a missing listing answers with a real 404 status instead of a streamed 200.
 */
export const revalidate = 60;
export function generateStaticParams(): { id: string }[] {
  return [];
}

/** Public listing detail — ISR (60s). Missing / hidden listings resolve to null → 404 page. */
const getListing = cache(async (id: string): Promise<ListingDetail | null> => {
  try {
    const listing = await serverGet(`/listings/${encodeURIComponent(id)}`, {
      schema: listingDetailSchema,
      revalidate: 60,
      tags: ['listings', `listing:${id}`],
    });
    // 단지 facts, 평형 and 최근 실거래 live on the complex (best effort — the page works without).
    const complex = listing.complex
      ? await serverGetOr(`/complexes/${encodeURIComponent(listing.complex.id)}`, null, {
          schema: complexDetailSchema,
          revalidate: 300,
          tags: ['complexes', `complex:${listing.complex.id}`],
        })
      : null;
    return withComplexDetail(listing, complex);
  } catch (error) {
    // 404 = gone / never existed, 400 = malformed id → both are "not found" for visitors.
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
    throw error;
  }
});

/**
 * Where the URL of a listing that is no longer public (거래완료 · 비공개 · 삭제 · 만료) leads: its
 * 단지 page, else the 지역 landing of its 매물 종류, else nothing (→ 404). 308 for closed / deleted
 * listings; 307 while 비공개 (HIDDEN by moderation may be restored).
 */
const getGoneTarget = cache(async (id: string) => {
  const status = await getListingStatus(id);
  if (!status || status.state !== 'GONE') return null;
  const permanent = status.status !== ListingStatus.HIDDEN;
  if (status.complexId) return { path: ROUTES.complex(status.complexId), permanent };
  if (!status.regionCode) return null;
  const index = await getSeoRegionIndex().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  const asset = assetSlugOf(status.assetType);
  const candidates = [status.regionCode, status.regionCode.slice(0, 8)];
  for (const code of candidates) {
    const region = index?.regions.find((r) => r.code === code);
    if (index && region && landingDecision(index.regions, region, asset).kind !== 'empty') {
      return { path: SEO_ROUTES.region(region, asset), permanent };
    }
  }
  return null;
});

/** 404 for unknown listings; redirect for listings that were public before. */
async function missingListing(id: string): Promise<never> {
  const gone = await getGoneTarget(id);
  if (gone) {
    if (gone.permanent) permanentRedirect(gone.path);
    redirect(gone.path);
  }
  notFound();
}

const ITEM_TYPE: Record<AssetType, 'Apartment' | 'House' | 'Place'> = {
  APT: 'Apartment',
  OFFICETEL: 'Apartment',
  ONEROOM: 'Apartment',
  HOUSE: 'House',
  COMMERCIAL: 'Place',
  LAND: 'Place',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  // Thrown here (not only in the page) so crawlers get a real 404 / redirect before streaming starts.
  if (!listing) return missingListing(id);
  return buildMetadata({
    title: listingFullTitle(listing),
    description: metaDescription(listing),
    path: ROUTES.listing(listing.id),
    image: listing.photos.find((p) => p.isCover)?.url ?? listing.photos[0]?.url,
    type: 'article',
  });
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return missingListing(id);

  const emdCode = listing.property.emdCode;
  const [similar, banners] = await Promise.all([
    serverGetOr(`/listings/${encodeURIComponent(id)}/similar`, EMPTY_SIMILAR, {
      schema: similarListingsSchema,
      revalidate: 300,
      tags: ['listings'],
    }),
    serverGetOr('/banners', [] as ServedBanner[], {
      query: {
        slot: BannerSlot.LISTING_SIDE,
        complexId: listing.complex?.id,
        regionCode: emdCode && REGION_CODE_PATTERN.test(emdCode) ? emdCode : undefined,
      },
      schema: servedBannersSchema,
      revalidate: 60,
      tags: ['banners'],
    }),
  ]);

  const amount = headlineAmount(listing);
  const crumbs = buildBreadcrumb(listing);
  const path = ROUTES.listing(listing.id);
  return (
    <>
      {/* Public fields only — never 호수 or owner contact. */}
      <JsonLd
        data={[
          listingJsonLd({
            path,
            name: listingFullTitle(listing),
            description: metaDescription(listing),
            images: listing.photos.slice(0, 6).map((p) => p.url),
            // Same figures as the page's 거래 금액: 월세 = 보증금 + 월세, never the rent alone.
            priceWon: amount !== null ? amount * 10_000 : null,
            monthlyRentWon:
              listing.dealType === DealType.MONTHLY &&
              listing.monthlyRent !== null &&
              listing.monthlyRent !== undefined
                ? listing.monthlyRent * 10_000
                : null,
            address: {
              locality: BRAND.region,
              street: regionLine(listing).replace(new RegExp(`^${BRAND.region}\\s*`), ''),
            },
            geo: { lat: listing.property.lat, lng: listing.property.lng },
            floorSizeSqm: listing.property.exclusiveArea ?? listing.property.landArea,
            rooms: listing.property.rooms,
            datePosted: listing.publishedAt ?? undefined,
            offerType:
              listing.dealType === DealType.SALE || listing.dealType === DealType.PRESALE
                ? 'sale'
                : 'rent',
            availability: listing.status === ListingStatus.RESERVED ? 'reserved' : 'available',
            itemType: ITEM_TYPE[listing.assetType],
            complexPath: listing.complex ? ROUTES.complex(listing.complex.id) : null,
          }),
          breadcrumbJsonLd(
            crumbs.map((c, i) => ({
              name: c.label,
              path: i === crumbs.length - 1 ? path : (c.href ?? path),
            })),
          ),
        ]}
      />
      <ListingPage
        listing={listing}
        similar={similar}
        ad={banners[0] ?? null}
        renderedAt={Date.now()}
      />
    </>
  );
}
