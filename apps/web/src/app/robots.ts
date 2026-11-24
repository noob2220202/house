import type { MetadataRoute } from 'next';
import { env } from '@/config/env';

/** Paths no crawler should fetch: private areas, forms, API / mock routes, dev, thin search. */
export const ROBOTS_DISALLOW = [
  '/api/',
  '/mock-api/',
  '/dev/',
  // Exact + subtree: a bare "/me" prefix would also block /media/* (listing photos).
  '/me$',
  '/me/',
  '/agent$',
  '/agent/',
  '/auth/',
  '/login',
  '/signup',
  '/deal/sell',
  '/deal/find',
  '/search',
  '/maintenance',
] as const;

/**
 * robots.txt. One group for every crawler (Googlebot, Yeti/네이버, Bingbot and the AI answer-engine
 * crawlers alike) plus the sitemap index. A mock-mode deployment (preview/staging) is never
 * indexable.
 */
export default function robots(): MetadataRoute.Robots {
  if (env.apiMock) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
