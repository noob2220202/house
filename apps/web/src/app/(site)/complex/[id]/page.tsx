import { BannerSlot, DEAL_TYPE_LABEL, DealType } from '@house/shared';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { BRAND } from '@/config/brand';
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
import { ComplexFaqSection, complexFaq } from '@/features/w-seo';
import { ApiError } from '@/lib/api';
import { serverGet, serverGetDetail, serverGetOr } from '@/lib/api/server';
import { formatCount } from '@/lib/format';
import {
  JsonLd,
  SEO_ROUTES,
  aggregateOfferJsonLd,
  breadcrumbJsonLd,
  buildMetadata,
  complexJsonLd,
  complexNodeId,
  faqJsonLd,
  landingDecision,
  placeLabel,
  type JsonLdNode,
} from '@/lib/seo';
import { getSeoRegionIndex } from '@/lib/seo/api';

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

/**
 * One fetch per request, shared by generateMetadata and the page. Null = not found (404 = gone /
 * never existed, 400 = malformed id). The outcome is cached, so a removed 단지 later 404s (D-E).
 */
const getComplex = cache((id: string) =>
  serverGetDetail(`/complexes/${encodeURIComponent(id)}`, {
    schema: complexDetailSchema,
    revalidate: REVALIDATE,
    tags: ['complexes', `complex:${id}`],
  }),
);

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

/**
 * The 단지's 읍면동/리 from the seo index: its 법정동 label ("해룡면 신대리") and, when indexable,
 * its 아파트 landing page (`/suncheon/<지역>/apt`) — internal link + containedInPlace. Best effort:
 * null when the index is unavailable or does not list the region.
 */
const getComplexRegion = cache(async (emdCode: string | null) => {
  if (!emdCode) return null;
  const key = emdCode.length === 10 && emdCode.endsWith('00') ? emdCode.slice(0, 8) : emdCode;
  const index = await getSeoRegionIndex().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  const region = index?.regions.find((r) => r.code === key);
  if (!index || !region) return null;
  const indexable = landingDecision(index.regions, region, 'apt').kind === 'index';
  return {
    emdName: region.emdName,
    landing: indexable
      ? { path: SEO_ROUTES.region(region, 'apt'), label: placeLabel(region) }
      : null,
  };
});

/** "{단지명} 실거래가·시세·매물 | 순천 {읍면동}" (the place replaces the brand suffix). */
function complexTitle(name: string, emdName: string | null): string {
  return `${name} 실거래가·시세·매물 | ${BRAND.seo.regionShort}${emdName ? ` ${emdName}` : ''}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const complex = await getComplex(id);
  // Thrown here (not only in the page) so crawlers get a real 404 / 308 before streaming starts.
  if (!complex) notFound();
  if (id !== complex.id) permanentRedirect(ROUTES.complex(complex.id));
  const [listings, region] = await Promise.all([
    getListings(complex.id),
    getComplexRegion(complex.emdCode),
  ]);
  return buildMetadata({
    title: complexTitle(complex.name, region?.emdName ?? complex.emdName),
    brandSuffix: false,
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
  const region = await getComplexRegion(complex.emdCode);
  const regionLanding = region?.landing ?? null;
  const latest = [...(stats?.latest ?? []), ...complex.latestTrades];
  const faq = complexFaq({
    complex: region ? { ...complex, emdName: region.emdName } : complex,
    listings: listings?.summary ?? null,
    latest,
    asOf: new Date(),
  });
  const offers = (listings?.summary.byDealType ?? [])
    .map((d) =>
      aggregateOfferJsonLd({
        itemId: complexNodeId(path),
        url: path,
        sale: d.dealType === DealType.SALE || d.dealType === DealType.PRESALE,
        count: d.count,
        lowPrice: d.priceMin,
        highPrice: d.priceMax,
        description: `${complex.name} ${DEAL_TYPE_LABEL[d.dealType]} 매물 ${formatCount(d.count)}건${
          d.dealType === DealType.MONTHLY ? ' (가격: 보증금)' : ''
        }`,
      }),
    )
    .filter((o): o is JsonLdNode => o !== null);
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
            emdName: region?.emdName ?? complex.emdName,
            geo: { lat: complex.lat, lng: complex.lng },
            households: complex.households,
            builtYear: complex.builtYear,
            floorPlans: complex.areaTypes.map((a) => ({
              name: a.typeName || a.pyeongLabel || `${a.exclusiveArea}㎡`,
              exclusiveAreaSqm: a.exclusiveArea,
              rooms: a.rooms,
              baths: a.baths,
              households: a.households,
            })),
            regionPath: regionLanding?.path ?? null,
          }),
          ...offers,
          ...(faq.length > 0 ? [faqJsonLd(faq)] : []),
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '아파트·분양권', path: ROUTES.map('apt') },
            ...(regionLanding
              ? [{ name: `${regionLanding.label} 아파트`, path: regionLanding.path }]
              : []),
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
      <ComplexFaqSection
        name={complex.name}
        items={faq}
        regionLink={
          regionLanding
            ? {
                href: regionLanding.path,
                label: `${BRAND.seo.regionShort} ${regionLanding.label} 아파트 시세 보기`,
              }
            : null
        }
      />
    </>
  );
}
