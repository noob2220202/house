import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { AGENCY_LISTINGS_PAGE_SIZE, agencyListingsQuery } from '@/features/w-agencies/api/queries';
import { getAgency, getAgencyListings } from '@/features/w-agencies/api/server';
import { AgencyPageView } from '@/features/w-agencies/components/AgencyPageView';
import { agencyTagline, displayPhone, fullAddress } from '@/features/w-agencies/lib/agency';
import { summarizeHours, toSchemaOrgHours } from '@/features/w-agencies/lib/hours';
import {
  maxListingPage,
  parseListingParams,
  serializeListingParams,
} from '@/features/w-agencies/lib/listing-params';
import { JsonLd, agencyJsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';
import { formatCount } from '@/lib/format';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/*
 * No route-level loading.tsx on purpose: with a loading boundary the shell is streamed before the
 * office is known and a missing office would answer 200 (soft 404). Without it the page resolves
 * first, so unknown / de-registered offices return a real 404. The office fetch is cached
 * (revalidate 120 s); the listing grid has its own skeleton.
 */

// One fetch per request for generateMetadata + the page.
const loadAgency = cache((id: string) => getAgency(id));

/** Search engines show ~160 characters of the description. */
const clip = (text: string, max = 160) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const agency = await loadAgency(id);
  if (!agency) notFound();
  const hours = summarizeHours(agency.businessHours);
  const description = [
    `${fullAddress(agency)} · 대표 공인중개사 ${agency.representativeName}`,
    agencyTagline(agency),
    `보유 매물 ${formatCount(agency.activeListingCount)}건`,
    hours ? `영업시간 ${hours}` : null,
    `등록번호 ${agency.registrationNumber}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return buildMetadata({
    title: `${agency.name} · ${agency.emdName ?? BRAND.region} 부동산`,
    description: clip(agency.intro ? `${agency.intro.slice(0, 70)} ${description}` : description),
    path: ROUTES.agency(agency.id),
    image: agency.coverUrl ?? agency.logoUrl,
  });
}

export default async function AgencyPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  const agency = await loadAgency(id);
  if (!agency) notFound();

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) sp.set(key, first);
  }
  const listingParams = parseListingParams(sp);
  // Out-of-range pages → first page of the same filters (bounded fetch-cache cardinality).
  if (listingParams.page > maxListingPage(agency, listingParams, AGENCY_LISTINGS_PAGE_SIZE)) {
    const qs = serializeListingParams({ ...listingParams, page: 1 }, sp).toString();
    redirect(qs ? `${ROUTES.agency(agency.id)}?${qs}` : ROUTES.agency(agency.id));
  }
  const initialListings = await getAgencyListings(agency.id, listingParams);

  return (
    <>
      <JsonLd
        data={[
          agencyJsonLd({
            path: ROUTES.agency(agency.id),
            name: agency.name,
            description: agency.intro ?? agencyTagline(agency) ?? undefined,
            image: agency.coverUrl ?? agency.logoUrl,
            telephone: displayPhone(agency.phone),
            address: fullAddress(agency),
            geo: { lat: agency.lat, lng: agency.lng },
            openingHours: toSchemaOrgHours(agency.businessHours),
          }),
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '중개사무소', path: ROUTES.agencies },
            { name: agency.name, path: ROUTES.agency(agency.id) },
          ]),
        ]}
      />
      <AgencyPageView
        agency={agency}
        initialListings={initialListings}
        initialListingsKey={JSON.stringify(agencyListingsQuery(agency.id, listingParams))}
      />
    </>
  );
}
