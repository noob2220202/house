import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AGENCY_LISTINGS_PAGE_SIZE, agencyListingsQuery } from '@/features/w-agencies/api/queries';
import { getAgencyListings } from '@/features/w-agencies/api/server';
import { agencyTagline, displayPhone, fullAddress } from '@/features/w-agencies/lib/agency';
import { toSchemaOrgHours } from '@/features/w-agencies/lib/hours';
import {
  maxListingPage,
  parseListingParams,
  serializeListingParams,
} from '@/features/w-agencies/lib/listing-params';
import {
  PRIMARY_ONLY as PRIMARY,
  loadOfficeListingFacts,
  loadOfficeSite,
} from '@/features/w-site/api/server';
import { OfficeHome } from '@/features/w-site/components/OfficeHome';
import { OFFICE_ROUTES, officeHomeTitle, officeHomeUrl } from '@/features/w-site/lib/site';
import { formatCount } from '@/lib/format';
import { JsonLd, agencyJsonLd, buildMetadata, clipDescription } from '@/lib/seo';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadOfficeSite(slug);
  if (!site) notFound();
  const a = site.agency;
  // The count the page shows: listings the office registered first (not the co-brokered ones).
  const { total } = await loadOfficeListingFacts(site);
  const lead = site.tagline ?? (a.intro ? a.intro.slice(0, 80) : agencyTagline(a));
  const description = clipDescription(
    [
      lead,
      `${fullAddress(a)} · 대표 공인중개사 ${a.representativeName}`,
      total !== null ? `매물 ${formatCount(total)}건` : null,
      `등록번호 ${a.registrationNumber}`,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  const meta = buildMetadata({
    title: officeHomeTitle(a.name),
    brandSuffix: false,
    description,
    // The office home is canonical on its own host (O8).
    path: officeHomeUrl(site),
    image: a.coverUrl ?? a.logoUrl,
  });
  return { ...meta, openGraph: { ...meta.openGraph, siteName: a.name } };
}

/** Home of an office's own site (`https://<slug>.<root>/`). */
export default async function OfficeSiteHomePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const site = await loadOfficeSite(slug);
  if (!site) notFound();
  const a = site.agency;

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) sp.set(key, first);
  }
  const listingParams = parseListingParams(sp);
  const toFirstPage = () => {
    const qs = serializeListingParams({ ...listingParams, page: 1 }, sp).toString();
    redirect(qs ? `${OFFICE_ROUTES.home}?${qs}` : OFFICE_ROUTES.home);
  };
  // Bound `?page` by the primary listings (before fetching it, so a crawler iterating pages
  // cannot fill the fetch cache): out-of-range pages → first page. 거래 only has office counters,
  // an upper bound; the fetched page closes the rest of the gap below.
  const facts = await loadOfficeListingFacts(site);
  const bound = maxListingPage(
    {
      activeListingCount: facts.total ?? a.activeListingCount,
      listingCounts: a.listingCounts,
      listingCountsByAsset: facts.byAsset,
    },
    listingParams,
    AGENCY_LISTINGS_PAGE_SIZE,
  );
  if (listingParams.page > bound) toFirstPage();
  const unfiltered = parseListingParams(new URLSearchParams());
  const isDefault =
    JSON.stringify(agencyListingsQuery(a.id, listingParams, PRIMARY)) ===
    JSON.stringify(agencyListingsQuery(a.id, unfiltered, PRIMARY));
  const all = facts.all;
  const filtered = isDefault ? null : await getAgencyListings(a.id, listingParams, PRIMARY);
  if (filtered && listingParams.page > 1 && listingParams.page > filtered.totalPages) toFirstPage();

  return (
    <>
      <JsonLd
        data={agencyJsonLd({
          path: officeHomeUrl(site),
          name: a.name,
          description: site.tagline ?? a.intro ?? agencyTagline(a) ?? undefined,
          image: a.coverUrl ?? a.logoUrl,
          telephone: displayPhone(a.phone),
          address: fullAddress(a),
          geo: { lat: a.lat, lng: a.lng },
          openingHours: toSchemaOrgHours(a.businessHours),
        })}
      />
      <OfficeHome
        site={site}
        listingTotal={facts.total}
        countsByAsset={facts.byAsset}
        countsExact={facts.exact}
        initialListings={isDefault ? all : filtered}
        initialListingsKey={JSON.stringify(agencyListingsQuery(a.id, listingParams, PRIMARY))}
      />
    </>
  );
}
