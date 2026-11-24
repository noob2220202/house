import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { ASSETS, ASSET_SLUGS, isAssetSlug } from '@/features/w-map/config/assets';
import { MapPageSkeleton } from '@/features/w-map/components/MapPageSkeleton';
import { MapSearchPage } from '@/features/w-map/components/MapSearchPage';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ assetType: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return ASSET_SLUGS.map((assetType) => ({ assetType }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { assetType } = await params;
  if (!isAssetSlug(assetType)) return {};
  const { seo } = ASSETS[assetType];
  return buildMetadata({
    title: `${BRAND.region} ${seo.title}`,
    description: seo.description,
    // Map state lives in the query string; every variation canonicalises to the bare path.
    path: ROUTES.map(assetType),
  });
}

export default async function MapPage({ params }: Props) {
  const { assetType } = await params;
  if (!isAssetSlug(assetType)) notFound();
  const asset = ASSETS[assetType];
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: ROUTES.home },
          { name: `${asset.label} 지도`, path: ROUTES.map(assetType) },
        ])}
      />
      {/* The page reads its state from the URL (useSearchParams) → client-rendered inside Suspense
          with a skeleton of the same layout, so there is no layout shift. */}
      <Suspense fallback={<MapPageSkeleton slug={assetType} />}>
        <MapSearchPage key={assetType} slug={assetType} />
      </Suspense>
    </>
  );
}
