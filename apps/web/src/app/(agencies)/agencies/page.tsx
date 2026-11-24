import { Suspense } from 'react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { AGENCY_LIST_PAGE_SIZE } from '@/features/w-agencies/api/queries';
import { getAgencies, getAgencyRegions } from '@/features/w-agencies/api/server';
import { AgencySearch } from '@/features/w-agencies/components/AgencySearch';
import { AgencySearchSkeleton } from '@/features/w-agencies/components/AgencySearchSkeleton';
import { AGENCY_FILTERS, toAgencyQuery } from '@/features/w-agencies/lib/filters';
import { formatDateShort } from '@/lib/format';
import { parseFilters } from '@/lib/map/url-state';
import { JsonLd, absoluteUrl, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '중개사무소 찾기',
  description: `${BRAND.regionFull}에 등록된 공인중개사사무소를 상호, 대표, 주소로 찾아보세요. 전문 분야와 지역으로 좁히고 지도에서 위치와 보유 매물을 바로 확인할 수 있어요.`,
  path: ROUTES.agencies,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AgenciesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  // Same query the client builds from the URL, so the server-rendered list is reused as-is.
  const filters = parseFilters(AGENCY_FILTERS, params);
  const listQuery = toAgencyQuery(filters, { pageSize: AGENCY_LIST_PAGE_SIZE });
  const regions = await getAgencyRegions();
  // Server-render (and cache) the list only for low-cardinality filters — chips, toggles, sort and
  // a known 읍면동. Free-text `q` and map-area searches canonicalise to /agencies anyway, so they
  // add no SEO value, and caching every distinct value would grow the fetch cache without bound.
  // The client fetches those itself.
  const knownRegion =
    !filters.emd || !!regions?.items.some((region) => region.emdCode === filters.emd);
  const initialList =
    filters.q || filters.area || !knownRegion ? null : await getAgencies({ ...listQuery, page: 1 });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '중개사무소 찾기', path: ROUTES.agencies },
          ]),
          ...(initialList && initialList.items.length > 0
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  name: `${BRAND.region} 중개사무소`,
                  numberOfItems: initialList.total,
                  itemListElement: initialList.items.map((a, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    name: a.name,
                    url: absoluteUrl(ROUTES.agency(a.id)),
                  })),
                },
              ]
            : []),
        ]}
      />
      <Suspense fallback={<AgencySearchSkeleton />}>
        <AgencySearch
          initialList={initialList}
          initialListKey={JSON.stringify(listQuery)}
          initialRegions={regions}
          asOf={formatDateShort(new Date())}
        />
      </Suspense>
    </>
  );
}
