import { BannerSlot } from '@house/shared';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { ROUTES } from '@/config/nav';
import {
  bannerListSchema,
  complexAgenciesSchema,
  complexDetailSchema,
  complexListingPageSchema,
  complexListingSummarySchema,
  complexStatsSchema,
  nearbyComplexesSchema,
  tradePageSchema,
} from '@/features/w-complex/api/schemas';
import { STATS_WINDOW_MONTHS } from '@/features/w-complex/api/queries';
import { complexDescription } from '@/features/w-complex/lib/complex';
import { loadComplexListings } from '@/features/w-complex/lib/complex-listings';
import { defaultAreaType } from '@/features/w-complex/lib/trend';
import { ComplexPageView } from '@/features/w-complex/page/ComplexPageView';
import { ApiError } from '@/lib/api';
import { serverGet, serverGetOr } from '@/lib/api/server';
import { JsonLd, breadcrumbJsonLd, buildMetadata, complexJsonLd } from '@/lib/seo';

/** ISR window of the public complex data (seconds). */
const REVALIDATE = 300;

/**
 * ISR: complexes are rendered on first request and cached for 5 min (no cookies are read here — the
 * viewer-specific bits load on the client). Declaring `generateStaticParams` makes the on-demand
 * render blocking, so a missing complex answers with a real 404 (and an alias with a real 308)
 * instead of a streamed 200.
 */
export const revalidate = 300;
export function generateStaticParams(): { id: string }[] {
  return [];
}

type Props = { params: Promise<{ id: string }> };

/** One fetch per request, shared by generateMetadata and the page. Null = not found. */
const getComplex = cache(async (id: string) => {
  try {
    return await serverGet(`/complexes/${encodeURIComponent(id)}`, {
      schema: complexDetailSchema,
      revalidate: REVALIDATE,
      tags: ['complexes', `complex:${id}`],
    });
  } catch (error) {
    // 404 = gone / never existed, 400 = malformed id (the API validates UUIDs) → both "not found".
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
    throw error;
  }
});

/** First listings + summary of the complex (`GET /listings?complexId=` + `GET /complexes/:id/listings`). */
const getListings = cache((id: string) =>
  loadComplexListings(
    id,
    { pageSize: 4 },
    {
      page: (query) =>
        serverGet('/listings', {
          query,
          schema: complexListingPageSchema,
          revalidate: 60,
          tags: ['listings'],
        }),
      summary: () =>
        serverGet(`/complexes/${encodeURIComponent(id)}/listings`, {
          schema: complexListingSummarySchema,
          revalidate: 60,
          tags: ['complexes', 'listings'],
        }),
    },
  ).catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const complex = await getComplex(id);
  // Thrown here (not only in the page) so crawlers get a real 404 / 308 before streaming starts.
  if (!complex) notFound();
  if (id !== complex.id) permanentRedirect(ROUTES.complex(complex.id));
  const listings = await getListings(complex.id);
  return buildMetadata({
    title: `${complex.name} 실거래가·매물`,
    description: complexDescription(complex, listings?.summary.total),
    path: ROUTES.complex(complex.id),
    image: complex.photos[0]?.url,
  });
}

export default async function ComplexPage({ params }: Props) {
  const { id } = await params;
  const complex = await getComplex(id);
  if (!complex) notFound();
  // One canonical URL per complex (the API may resolve aliases / legacy ids).
  if (id !== complex.id) permanentRedirect(ROUTES.complex(complex.id));

  const base = `/complexes/${encodeURIComponent(complex.id)}`;
  const areaTypeId = defaultAreaType(complex.areaTypes)?.id;
  const [stats, trades, listings, nearby, agencies, featured] = await Promise.all([
    serverGetOr(`${base}/stats`, null, {
      query: { dealType: 'SALE', areaTypeId, months: STATS_WINDOW_MONTHS },
      schema: complexStatsSchema,
      revalidate: REVALIDATE,
      tags: ['complexes'],
    }),
    serverGetOr(`${base}/trades`, null, {
      query: { dealType: 'SALE', areaTypeId, pageSize: 8 },
      schema: tradePageSchema,
      revalidate: REVALIDATE,
      tags: ['complexes'],
    }),
    getListings(complex.id),
    serverGetOr(`${base}/nearby`, null, {
      query: { limit: 6 },
      schema: nearbyComplexesSchema,
      revalidate: REVALIDATE,
      tags: ['complexes'],
    }),
    serverGetOr(`${base}/agencies`, null, {
      query: { limit: 10 },
      schema: complexAgenciesSchema,
      revalidate: REVALIDATE,
      tags: ['complexes'],
    }),
    // Admin-managed ad slot: short cache so schedule changes show up quickly.
    serverGetOr('/banners', undefined, {
      query: { slot: BannerSlot.COMPLEX_FEATURED_AGENCY, complexId: complex.id },
      schema: bannerListSchema,
      revalidate: 60,
      tags: ['banners'],
    }),
  ]);

  const path = ROUTES.complex(complex.id);
  return (
    <>
      <JsonLd
        data={[
          complexJsonLd({
            path,
            name: complex.name,
            description: complexDescription(complex, listings?.summary.total),
            image: complex.photos[0]?.url,
            address: complex.roadAddress ?? complex.jibunAddress ?? undefined,
            geo: { lat: complex.lat, lng: complex.lng },
            households: complex.households,
            builtYear: complex.builtYear,
          }),
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '아파트·분양권', path: ROUTES.map('apt') },
            { name: complex.name, path },
          ]),
        ]}
      />
      <ComplexPageView
        data={{
          complex,
          stats,
          trades,
          listings,
          nearby: nearby?.items ?? [],
          agencies: agencies?.items ?? [],
          featured,
        }}
      />
    </>
  );
}
