import { BannerSlot, DealType, REGION_CODE_PATTERN } from '@house/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ROUTES } from '@/config/nav';
import {
  EMPTY_SIMILAR,
  listingDetailSchema,
  servedBannersSchema,
  similarListingsSchema,
  type ListingDetail,
  type ServedBanner,
} from '@/features/w-listing/api/schemas';
import { ListingPage } from '@/features/w-listing/components/ListingPage';
import {
  buildBreadcrumb,
  headlineAmount,
  listingFullTitle,
  metaDescription,
  regionLine,
} from '@/features/w-listing/lib/view';
import { ApiError } from '@/lib/api';
import { serverGet, serverGetOr } from '@/lib/api/server';
import { JsonLd, breadcrumbJsonLd, buildMetadata, listingJsonLd } from '@/lib/seo';

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
    return await serverGet(`/listings/${encodeURIComponent(id)}`, {
      schema: listingDetailSchema,
      revalidate: 60,
      tags: ['listings', `listing:${id}`],
    });
  } catch (error) {
    // 404 = gone / never existed, 400 = malformed id → both are "not found" for visitors.
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  // Thrown here (not only in the page) so crawlers get a real 404 status before streaming starts.
  if (!listing) notFound();
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
  if (!listing) notFound();

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
            priceWon:
              listing.dealType === DealType.MONTHLY
                ? listing.monthlyRent !== null && listing.monthlyRent !== undefined
                  ? listing.monthlyRent * 10_000
                  : null
                : amount !== null
                  ? amount * 10_000
                  : null,
            address: { locality: '순천시', street: regionLine(listing).replace(/^순천시\s*/, '') },
            geo: { lat: listing.property.lat, lng: listing.property.lng },
            floorSizeSqm: listing.property.exclusiveArea ?? listing.property.landArea,
            rooms: listing.property.rooms,
            datePosted: listing.publishedAt ?? undefined,
            offerType:
              listing.dealType === DealType.SALE || listing.dealType === DealType.PRESALE
                ? 'sale'
                : 'rent',
          }),
          breadcrumbJsonLd(
            crumbs.map((c, i) => ({
              name: c.label,
              path: i === crumbs.length - 1 ? path : (c.href ?? path),
            })),
          ),
        ]}
      />
      <ListingPage listing={listing} similar={similar} ad={banners[0] ?? null} />
    </>
  );
}
