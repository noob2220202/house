import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { env } from '@/config/env';

/**
 * Absolute URL for a site path. Non-ASCII path characters (Korean landing slugs) are
 * percent-encoded once, so canonicals, sitemaps and JSON-LD all carry the same spelling.
 */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${env.siteUrl}${encodeURI(safeDecode(p))}`;
}

/** decodeURI that leaves malformed input alone (so an already-encoded path is not encoded twice). */
function safeDecode(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

export const DEFAULT_TITLE = `${BRAND.name} | ${BRAND.tagline}`;
export const DEFAULT_DESCRIPTION = `${BRAND.regionFull} 아파트·분양권, 원룸·투룸, 주택, 상가, 토지 매물을 지도에서 한 번에. ${BRAND.description}.`;

export interface PageMetaInput {
  /** Page title without the brand suffix. Omit on the home page. */
  title?: string;
  /**
   * `false` = use `title` as is (it already names the place, e.g. a 단지 page
   * "{단지명} 실거래가·시세·매물 | 순천 해룡면 신대리"); default appends " | {brand}".
   */
  brandSuffix?: boolean;
  description?: string;
  /** Site path for canonical + og:url, e.g. "/listing/123". */
  path: string;
  /** Canonical path when it differs from `path` (duplicate pages point at the original). */
  canonicalPath?: string;
  /** Absolute or site-relative OG image. */
  image?: string | null;
  /**
   * Keep the page out of search results. `true` = noindex, nofollow (my page, forms, dev);
   * `'follow'` = noindex but follow links (thin landing pages whose links still matter).
   */
  noindex?: boolean | 'follow';
  type?: 'website' | 'article';
}

/** Default Open Graph image (rendered from apps/web/tools/og-default.html). */
export const DEFAULT_OG_IMAGE = '/og-default.png';

/** Search engines show about 80 (Naver) to 160 (Google) characters of the description. */
export function clipDescription(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Per-page metadata builder: title, description, canonical, Open Graph, Twitter card, robots.
 *
 *   export const metadata = buildMetadata({ title: '아파트·분양권 지도', path: '/map/apt' });
 *   export async function generateMetadata({ params }) { …; return buildMetadata({ … }); }
 */
export function buildMetadata({
  title,
  brandSuffix = true,
  description = DEFAULT_DESCRIPTION,
  path,
  canonicalPath,
  image,
  noindex,
  type = 'website',
}: PageMetaInput): Metadata {
  const fullTitle = title ? (brandSuffix ? `${title} | ${BRAND.name}` : title) : DEFAULT_TITLE;
  const url = absoluteUrl(path);
  const desc = clipDescription(description);
  // Every page has a preview image: its own, or the branded default (public/og-default.png, 1200×630).
  const images = [{ url: absoluteUrl(image ?? DEFAULT_OG_IMAGE) }];
  return {
    title: { absolute: fullTitle },
    description: desc,
    alternates: { canonical: absoluteUrl(canonicalPath ?? path) },
    robots: noindex ? { index: false, follow: noindex === 'follow' } : undefined,
    openGraph: {
      type,
      url,
      title: fullTitle,
      description: desc,
      siteName: BRAND.name,
      locale: BRAND.locale,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      images: images.map((i) => i.url),
    },
  };
}

/**
 * Search console ownership tags (네이버 서치어드바이저 / Google Search Console). Set the env vars
 * to the content value each console shows; empty or unset = the tag is omitted.
 */
export function siteVerification(
  source: Record<string, string | undefined> = {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    naver: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION,
  },
): Metadata['verification'] | undefined {
  const google = source.google?.trim();
  const naver = source.naver?.trim();
  if (!google && !naver) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(naver ? { other: { 'naver-site-verification': naver } } : {}),
  };
}

/** Root-layout defaults. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: DEFAULT_TITLE, template: `%s | ${BRAND.name}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: BRAND.name,
  formatDetection: { telephone: false, address: false, email: false },
  verification: siteVerification(),
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
