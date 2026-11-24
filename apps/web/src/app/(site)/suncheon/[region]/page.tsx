import { notFound, redirect } from 'next/navigation';
import {
  LANDING_ASSET_SLUGS,
  SEO_ROUTES,
  findRegionBySlug,
  landingCounts,
  landingDecision,
} from '@/lib/seo';
import { getSeoRegionIndex } from '@/lib/seo/api';

type Props = { params: Promise<{ region: string }> };

export const revalidate = 600;
export function generateStaticParams(): { region: string }[] {
  return [];
}

/**
 * /suncheon/<지역> has no page of its own: it sends visitors to the region's 매물 종류 page with
 * the most listings (307 — the target changes with the data), or 404 without any data.
 */
export default async function RegionRedirect({ params }: Props) {
  const { region: param } = await params;
  const index = await getSeoRegionIndex();
  const region = findRegionBySlug(index.regions, param);
  if (!region) notFound();
  const best = LANDING_ASSET_SLUGS.map((asset) => ({
    asset,
    decision: landingDecision(index.regions, region, asset),
    counts: landingCounts(region, asset),
  }))
    .filter((c) => c.decision.kind !== 'empty')
    .sort(
      (a, b) =>
        Number(b.decision.kind === 'index') - Number(a.decision.kind === 'index') ||
        b.counts.listings + b.counts.trades - (a.counts.listings + a.counts.trades),
    )[0];
  if (!best) notFound();
  redirect(SEO_ROUTES.region(region, best.asset));
}
