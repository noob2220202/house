import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { env } from '@/config/env';
import { ROUTES } from '@/config/nav';
import { getAgencyListings } from '@/features/w-agencies/api/server';
import { EMPTY_SIMILAR, type ListingDetail } from '@/features/w-listing/api/schemas';
import { getListingDetail } from '@/features/w-listing/api/server';
import { ListingPage } from '@/features/w-listing/components/ListingPage';
import type { ListingOfficeVariant } from '@/features/w-listing/lib/office';
import { listingFullTitle, metaDescription } from '@/features/w-listing/lib/view';
import { loadOfficeSite } from '@/features/w-site/api/server';
import { OfficeMoreListings } from '@/features/w-site/components/OfficeMoreListings';
import { mainSiteUrl } from '@/features/w-site/lib/host';
import { OFFICE_ROUTES, officeHomeUrl } from '@/features/w-site/lib/site';
import type { OfficeSite } from '@/features/w-site/api/schemas';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string; id: string }> };

/**
 * ISR like the main listing page (60 s, nothing visitor-specific is read). `generateStaticParams`
 * makes the on-demand render blocking, so a missing listing answers with a real 404.
 */
export const revalidate = 60;
export function generateStaticParams(): { slug: string; id: string }[] {
  return [];
}

const loadListing = cache(getListingDetail);

/**
 * The listing as the office's site shows it: only listings whose primary (최초 등록) office is
 * this site's office (anything else → 404), with the office as the only contact.
 */
const loadOfficeListing = cache(
  async (
    slug: string,
    id: string,
  ): Promise<{ site: OfficeSite; listing: ListingDetail } | null> => {
    const [site, listing] = await Promise.all([loadOfficeSite(slug), loadListing(id)]);
    if (!site || !listing) return null;
    const primary = listing.agencies.find((a) => a.isPrimary);
    if (!primary || primary.agencyId !== site.agency.id) return null;
    return { site, listing: { ...listing, agencies: [primary] } };
  },
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  // No live site: the [slug] layout renders the office-site 404 (not the in-site "매물" one).
  if (!(await loadOfficeSite(slug))) return { robots: { index: false, follow: false } };
  const hit = await loadOfficeListing(slug, id);
  if (!hit) notFound();
  const { site, listing } = hit;
  const meta = buildMetadata({
    title: `${listingFullTitle(listing)} | ${site.agency.name}`,
    brandSuffix: false,
    description: metaDescription(listing),
    path: `${officeHomeUrl(site)}listing/${encodeURIComponent(listing.id)}`,
    // Same listing as the main site's page: that one is canonical (O8, no duplicate content).
    canonicalPath: ROUTES.listing(listing.id),
    image: listing.photos.find((p) => p.isCover)?.url ?? listing.photos[0]?.url,
    type: 'article',
  });
  return { ...meta, openGraph: { ...meta.openGraph, siteName: site.agency.name } };
}

/** `https://<slug>.<root>/listing/<id>` — the listing page in its office-site variant. */
export default async function OfficeSiteListingPage({ params }: Props) {
  const { slug, id } = await params;
  if (!(await loadOfficeSite(slug))) return null; // the layout answers 404 (see generateMetadata)
  const hit = await loadOfficeListing(slug, id);
  if (!hit) notFound();
  const { site, listing } = hit;
  const a = site.agency;

  const others = await getAgencyListings(a.id, { page: 1 }, { primaryOnly: true });
  const more = (others?.items ?? []).filter((l) => l.id !== listing.id).slice(0, 4);
  const office: ListingOfficeVariant = {
    name: a.name,
    homeHref: OFFICE_ROUTES.home,
    listingsHref: OFFICE_ROUTES.listings,
    mainListingUrl: mainSiteUrl(ROUTES.listing(listing.id)),
    mainSiteUrl: env.siteUrl,
  };

  return (
    <ListingPage
      listing={listing}
      similar={EMPTY_SIMILAR}
      ad={null}
      renderedAt={Date.now()}
      office={office}
      officeMore={<OfficeMoreListings agencyName={a.name} items={more} />}
    />
  );
}
