import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { AboutView, type AboutNap } from '@/features/w-seo';
import { ApiError } from '@/lib/api/errors';
import {
  JsonLd,
  SEO_ROUTES,
  absoluteUrl,
  breadcrumbJsonLd,
  buildMetadata,
  organizationJsonLd,
} from '@/lib/seo';
import { getSeoRegionIndex } from '@/lib/seo/api';
import { getPublicSiteSettings } from '@/lib/site/settings';

/*
 * Rendered per request (`connection()`): a build-time prerender would bake in an empty page (no
 * API during `next build`) for a whole revalidate window. The API reads stay in the Next data
 * cache (lib/seo/api revalidate windows) and the API caches them in Redis.
 */

export const metadata = buildMetadata({
  title: '서비스 소개',
  description: `${BRAND.name} 서비스 소개 — ${BRAND.seo.summary}. 운영자 정보, 서비스 지역, 데이터 출처(국토교통부 실거래가)와 갱신 주기, 연락처.`,
  path: SEO_ROUTES.about,
});

const real = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

export default async function AboutPage() {
  await connection();
  const [settings, index] = await Promise.all([
    getPublicSiteSettings(),
    getSeoRegionIndex().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
  ]);
  const b = settings.BUSINESS_INFO ?? {};
  const c = settings.CONTACT ?? {};
  // Only what the operator filled in — never the footer placeholders.
  const nap: AboutNap = {
    companyName: real(b.companyName),
    ceoName: real(b.ceoName),
    businessNumber: real(b.businessNumber),
    mailOrderNumber: real(b.mailOrderNumber),
    address: real(b.address),
    phone: real(c.phone) ?? real(b.phone),
    email: real(c.email) ?? real(b.email),
    hours: real(c.hours),
  };
  const coverage = index
    ? {
        regions: index.regions.length,
        listings: index.regions
          .filter(
            (r) => r.code.length === 8 || !index.regions.some((p) => p.code === r.code.slice(0, 8)),
          )
          .reduce((n, r) => n + Object.values(r.listingCounts).reduce((a, x) => a + x, 0), 0),
      }
    : null;

  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd({
            legalName: nap.companyName,
            address: nap.address,
            telephone: nap.phone,
            email: nap.email,
            aboutPath: SEO_ROUTES.about,
          }),
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: `${BRAND.name} 서비스 소개`,
            url: absoluteUrl(SEO_ROUTES.about),
            inLanguage: 'ko-KR',
            about: { '@id': `${absoluteUrl('/')}#organization` },
          },
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '서비스 소개', path: SEO_ROUTES.about },
          ]),
        ]}
      />
      <AboutView nap={nap} coverage={coverage} />
    </>
  );
}
