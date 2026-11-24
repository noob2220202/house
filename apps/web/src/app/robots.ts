import type { MetadataRoute } from 'next';
import { env } from '@/config/env';

/**
 * robots.txt. Private areas (my page, broker console, forms), API paths, dev routes and thin search
 * result pages are disallowed. A mock-mode deployment (preview/staging) is never indexable.
 */
export default function robots(): MetadataRoute.Robots {
  if (env.apiMock) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/mock-api/',
          '/dev/',
          '/me',
          '/agent',
          '/login',
          '/signup',
          '/deal/sell',
          '/deal/find',
          '/search',
          '/maintenance',
        ],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
