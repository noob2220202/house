import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { RegionIndexView } from '@/features/w-seo';
import {
  JsonLd,
  SEO_ROUTES,
  breadcrumbJsonLd,
  buildMetadata,
  indexableLandings,
  itemListJsonLd,
  landingTitle,
} from '@/lib/seo';
import { getSeoRegionIndex } from '@/lib/seo/api';

/*
 * Rendered per request (`connection()`): a build-time prerender would bake in an empty page (no
 * API during `next build`) for a whole revalidate window. The API reads stay in the Next data
 * cache (lib/seo/api revalidate windows) and the API caches them in Redis.
 */

const TITLE = `${BRAND.seo.regionShort} 지역별 부동산 시세 · 읍면동별 매물과 아파트 실거래`;

export const metadata = buildMetadata({
  title: TITLE,
  description: `${BRAND.region} 읍면동·지구별 아파트, 원룸·투룸, 주택, 상가, 토지 매물 수와 최근 12개월 국토교통부 아파트 매매 실거래 건수를 한 페이지에서 비교하세요.`,
  path: SEO_ROUTES.regions,
});

export default async function SuncheonRegionsPage() {
  await connection();
  const index = await getSeoRegionIndex();
  const landings = indexableLandings(index.regions);
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '순천 지역별 시세', path: SEO_ROUTES.regions },
          ]),
          itemListJsonLd(
            TITLE,
            landings.map((l) => ({
              name: landingTitle(l.region, l.asset),
              path: SEO_ROUTES.region(l.region, l.asset),
            })),
          ),
        ]}
      />
      <RegionIndexView index={index} />
    </>
  );
}

