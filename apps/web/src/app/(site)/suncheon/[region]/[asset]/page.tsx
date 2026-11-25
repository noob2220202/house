import { ListingSort } from '@house/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ROUTES, type MapAssetSlug } from '@/config/nav';
import { LandingView, landingDescription, placeFull, type LandingLink } from '@/features/w-seo';
import { listingPageSchema } from '@/lib/api/schemas/listing';
import { serverGetOr } from '@/lib/api/server';
import { formatCount } from '@/lib/format';
import { buildMapHref } from '@/lib/map/url-state';
import {
  districtAlias,
  JsonLd,
  LANDING_ASSETS,
  LANDING_ASSET_SLUGS,
  SEO_ROUTES,
  breadcrumbJsonLd,
  buildMetadata,
  findRegionBySlug,
  indexableLandings,
  isLandingAsset,
  itemListJsonLd,
  landingCounts,
  landingDecision,
  landingTitle,
  placeJsonLd,
  placeLabel,
} from '@/lib/seo';
import { getRegionLanding, getSeoRegionIndex } from '@/lib/seo/api';

type Props = { params: Promise<{ region: string; asset: string }> };

/**
 * ISR (10 min, like the API cache). `generateStaticParams` makes the on-demand render blocking, so
 * an unknown 지역 / 매물 종류 or a page without any data answers a real 404.
 */
export const revalidate = 600;
export function generateStaticParams(): { region: string; asset: string }[] {
  return [];
}

/** Zoom that shows one 읍면동 on the map. */
const REGION_MAP_ZOOM = 15;

/** One resolution per request, shared by generateMetadata and the page. Null = 404. */
const resolve = cache(async (regionParam: string, assetParam: string) => {
  if (!isLandingAsset(assetParam)) return null;
  const asset: MapAssetSlug = assetParam;
  const index = await getSeoRegionIndex();
  const region = findRegionBySlug(index.regions, regionParam);
  if (!region) return null;
  const decision = landingDecision(index.regions, region, asset);
  if (decision.kind === 'empty') return null;
  const landing = await getRegionLanding(region.code, LANDING_ASSETS[asset].assetTypes);
  if (!landing) return null;
  return { index, region, asset, decision, landing };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: regionParam, asset: assetParam } = await params;
  const r = await resolve(regionParam, assetParam);
  // Thrown here (not only in the page) so crawlers get a real 404 before streaming starts.
  if (!r) notFound();
  const path = SEO_ROUTES.region(r.region, r.asset);
  return buildMetadata({
    title: landingTitle(r.region, r.asset),
    description: landingDescription(r.landing, r.asset),
    path,
    canonicalPath:
      r.decision.kind === 'duplicate'
        ? SEO_ROUTES.region(r.decision.canonical, r.asset)
        : undefined,
    noindex: r.decision.kind === 'thin' ? 'follow' : undefined,
  });
}

export default async function RegionLandingPage({ params }: Props) {
  const { region: regionParam, asset: assetParam } = await params;
  const r = await resolve(regionParam, assetParam);
  if (!r) notFound();
  const { index, region, asset, landing } = r;
  const cfg = LANDING_ASSETS[asset];
  const path = SEO_ROUTES.region(region, asset);

  // Non-아파트 pages link to the latest listings of the region (best effort).
  const listings = cfg.complexes
    ? []
    : ((
        await serverGetOr('/listings', null, {
          query: {
            emdCode: region.code,
            assetTypes: [...cfg.assetTypes],
            sort: ListingSort.LATEST,
            pageSize: 8,
          },
          schema: listingPageSchema,
          revalidate: 300,
          tags: ['listings'],
        })
      )?.items ?? []);

  const otherAssets: LandingLink[] = LANDING_ASSET_SLUGS.flatMap((a) =>
    a === asset || landingDecision(index.regions, region, a).kind === 'index'
      ? [
          {
            href: SEO_ROUTES.region(region, a),
            label: LANDING_ASSETS[a].noun,
            meta: `매물 ${formatCount(landingCounts(region, a).listings)}건`,
            current: a === asset,
          },
        ]
      : [],
  );
  const otherRegions: LandingLink[] = indexableLandings(index.regions)
    .filter((l) => l.asset === asset && l.region.code !== region.code)
    .sort((a, b) => b.counts.listings - a.counts.listings || b.counts.trades - a.counts.trades)
    .slice(0, 12)
    .map((l) => ({
      href: SEO_ROUTES.region(l.region, asset),
      label: `${placeLabel(l.region)} ${cfg.noun}`,
      meta: [
        `매물 ${formatCount(l.counts.listings)}건`,
        l.counts.trades ? `실거래 ${formatCount(l.counts.trades)}건` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }));

  const mapHref =
    region.lat !== null && region.lng !== null
      ? buildMapHref(ROUTES.map(asset), {
          view: { center: { lat: region.lat, lng: region.lng }, zoom: REGION_MAP_ZOOM },
        })
      : ROUTES.map(asset);
  const title = landingTitle(region, asset);

  return (
    <>
      <JsonLd
        data={[
          placeJsonLd({
            path,
            name: region.emdName,
            alternateName: districtAlias(region.emdName) ?? null,
            description: `${placeFull(region)} ${cfg.topic}`,
            geo:
              region.lat !== null && region.lng !== null
                ? { lat: region.lat, lng: region.lng }
                : null,
          }),
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '순천 지역별 시세', path: SEO_ROUTES.regions },
            { name: title, path },
          ]),
          ...(landing.complexes.length > 0
            ? [
                itemListJsonLd(
                  `${region.emdName} 아파트 단지`,
                  landing.complexes.map((c) => ({ name: c.name, path: ROUTES.complex(c.id) })),
                ),
              ]
            : []),
        ]}
      />
      <LandingView
        landing={landing}
        asset={asset}
        listings={listings}
        otherAssets={otherAssets.length > 1 ? otherAssets : []}
        otherRegions={otherRegions}
        mapHref={mapHref}
      />
    </>
  );
}
