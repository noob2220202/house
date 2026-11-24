import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { env } from '@/config/env';

/** Absolute URL for a site path. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${env.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export const DEFAULT_TITLE = `${BRAND.name} | ${BRAND.tagline}`;
export const DEFAULT_DESCRIPTION = `${BRAND.regionFull} 아파트·분양권, 원룸·투룸, 주택, 상가, 토지 매물을 지도에서 한 번에. ${BRAND.description}.`;

export interface PageMetaInput {
  /** Page title without the brand suffix. Omit on the home page. */
  title?: string;
  description?: string;
  /** Site path for canonical + og:url, e.g. "/listing/123". */
  path: string;
  /** Absolute or site-relative OG image. */
  image?: string | null;
  /** Keep the page out of search results (my page, forms, dev). */
  noindex?: boolean;
  type?: 'website' | 'article';
}

/** Default Open Graph image (rendered from apps/web/tools/og-default.html). */
export const DEFAULT_OG_IMAGE = '/og-default.png';

/**
 * Per-page metadata builder: title, description, canonical, Open Graph, Twitter card, robots.
 *
 *   export const metadata = buildMetadata({ title: '아파트·분양권 지도', path: '/map/apt' });
 *   export async function generateMetadata({ params }) { …; return buildMetadata({ … }); }
 */
export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  noindex,
  type = 'website',
}: PageMetaInput): Metadata {
  const fullTitle = title ? `${title} | ${BRAND.name}` : DEFAULT_TITLE;
  const url = absoluteUrl(path);
  // Every page has a preview image: its own, or the branded default (public/og-default.png, 1200×630).
  const images = [{ url: absoluteUrl(image ?? DEFAULT_OG_IMAGE) }];
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type,
      url,
      title: fullTitle,
      description,
      siteName: BRAND.name,
      locale: BRAND.locale,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: images.map((i) => i.url),
    },
  };
}

/** Root-layout defaults. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: DEFAULT_TITLE, template: `%s | ${BRAND.name}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: BRAND.name,
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    locale: BRAND.locale,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};
