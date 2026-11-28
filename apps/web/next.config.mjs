import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentSecurityPolicy, parseOrigins } from './csp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Parallel dev servers / builds: every agent uses its own build dir, e.g.
//   NEXT_DIST_DIR=.next-w-home NEXT_PUBLIC_API_MOCK=1 pnpm exec next dev --port 3101
const distDir = process.env.NEXT_DIST_DIR || '.next';

// Next rewrites the tsconfig it is given (adds "<distDir>/types/**/*.ts"). To keep the committed
// tsconfig.json stable while several dist dirs are in use, Next gets its own derived tsconfig.
const nextTsconfig = `tsconfig.${distDir.replace(/^\./, '')}.json`;
const nextTsconfigBody = `${JSON.stringify(
  {
    extends: './tsconfig.json',
    include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', `${distDir}/types/**/*.ts`],
    exclude: ['node_modules', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  null,
  2,
)}\n`;
const nextTsconfigPath = path.join(here, nextTsconfig);
if (
  !fs.existsSync(nextTsconfigPath) ||
  fs.readFileSync(nextTsconfigPath, 'utf8') !== nextTsconfigBody
) {
  fs.writeFileSync(nextTsconfigPath, nextTsconfigBody);
}

const API_ORIGIN = (process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
// Where /media/* is fetched from by the image optimizer (and by browsers when no nginx is in front:
// dev, e2e). Rewrites are baked in at build time: production builds get nginx's loopback media
// origin (deploy.sh build env, MEDIA_ORIGIN=http://127.0.0.1:8088). The API serves no files, so
// the API fallback below only suits a dev API that happens to.
const MEDIA_ORIGIN = (process.env.MEDIA_ORIGIN || API_ORIGIN).replace(/\/$/, '');
const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.MEDIA_ORIGIN && process.env.NEXT_PUBLIC_API_MOCK !== '1') {
  console.warn(
    '[next.config] MEDIA_ORIGIN is not set: /_next/image will fetch /media from the API and fail. ' +
      'Set it to the media origin (deploy kit: http://127.0.0.1:8088).',
  );
}

/** Extra absolute media hosts, comma separated: "https://cdn.example.kr,https://media.example.kr". */
const mediaHosts = parseOrigins(process.env.NEXT_PUBLIC_MEDIA_HOSTS);

/**
 * remotePatterns for NEXT_PUBLIC_MEDIA_HOSTS (comma separated absolute URLs, e.g. a CDN:
 * "https://cdn.example.kr/media"): exactly each listed host + port, under the listed path only
 * ("/media/**"; a bare origin allows "/**"), without query strings. Production builds accept
 * https hosts only. Nothing is listed by default, so the optimizer fetches no remote image.
 */
export function mediaRemotePatterns(csv, { production = false } = {}) {
  return (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new URL(s))
    .filter((u) => u.protocol === 'https:' || (!production && u.protocol === 'http:'))
    .map((u) => ({
      protocol: /** @type {'http' | 'https'} */ (u.protocol.replace(':', '')),
      hostname: u.hostname,
      port: u.port,
      pathname: `${u.pathname.replace(/\/+$/, '')}/**`,
      search: '',
    }));
}

/**
 * Domain of the 사무소 홈페이지 hosts (`<slug>.<root>`): same rule as src/config/env.ts
 * `siteRootDomain` (NEXT_PUBLIC_SITE_ROOT_DOMAIN, else the hostname of NEXT_PUBLIC_SITE_URL).
 */
export function siteRootDomainOf(environment = process.env) {
  const explicit = environment.NEXT_PUBLIC_SITE_ROOT_DOMAIN;
  let root = explicit;
  if (!root) {
    try {
      root = new URL(environment.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname;
    } catch {
      root = 'localhost';
    }
  }
  return root.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Office-site routing as config rewrites (`has` / `missing` host), not middleware rewrites.
 * Behind nginx Next runs with `--hostname 127.0.0.1` and X-Forwarded-Proto https: a middleware
 * rewrite URL is normalized to https://localhost:<port> while the router's own URL is
 * https://127.0.0.1:<port>, so Next took every middleware rewrite for an external proxy and
 * answered 500. Config rewrites are matched inside the router and never compare origins.
 * The label pattern only shapes the host; the slug rules (reserved words, `--`) are enforced by
 * GET /sites/:slug (400/404 → the office 404 page), and nginx forwards only issued office hosts.
 * The middleware still sends every other path of an office host to the main site.
 */
export function officeSiteRewrites(rootDomain) {
  const root = rootDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const label = '[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?';
  const officeHost = [{ type: 'host', value: `(?<slug>${label})\\.${root}` }];
  const anyOfficeHost = [{ type: 'host', value: `${label}\\.${root}` }];
  return [
    // Main host: the internal routes are not pages of the main site (Next's regular 404).
    { source: '/office-site', missing: anyOfficeHost, destination: '/_not-found-office-site' },
    {
      source: '/office-site/:path*',
      missing: anyOfficeHost,
      destination: '/_not-found-office-site',
    },
    // Office host: the few office pages.
    { source: '/', has: officeHost, destination: '/office-site/:slug' },
    { source: '/listing/:id', has: officeHost, destination: '/office-site/:slug/listing/:id' },
    { source: '/robots.txt', has: officeHost, destination: '/office-site/:slug/robots.txt' },
    { source: '/sitemap.xml', has: officeHost, destination: '/office-site/:slug/sitemap.xml' },
  ];
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy({
      dev: !isProd,
      mediaHosts,
      postcodeScriptUrl: process.env.NEXT_PUBLIC_POSTCODE_SCRIPT_URL,
    }),
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  reactStrictMode: true,
  poweredByHeader: false,
  // nginx gzips responses (deploy/nginx/snippets/house-server-common.conf); compressing in Node too only costs CPU.
  // Dev / e2e without nginx are served uncompressed, which is fine on loopback.
  compress: false,
  // Keep screenshots clean; build errors still show in the overlay.
  devIndicators: false,
  // Lint runs separately via `pnpm lint` (flat config); don't run it twice during build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { tsconfigPath: nextTsconfig },
  transpilePackages: ['@house/ui'],
  images: {
    formats: ['image/avif', 'image/webp'],
    // What the optimizer (/_next/image) may fetch. Local sources only under /media — rewritten
    // below to MEDIA_ORIGIN, nginx's loopback media origin in production, which serves nothing
    // but public media files — and the mock stand-ins (/mock-api, Next's own routes). Never a
    // loopback API host or /api/v1/*: the optimizer must not become a request path into the API.
    localPatterns: [{ pathname: '/media/**' }, { pathname: '/mock-api/**' }],
    // Absolute media hosts only when configured (NEXT_PUBLIC_MEDIA_HOSTS, e.g. a CDN).
    remotePatterns: mediaRemotePatterns(process.env.NEXT_PUBLIC_MEDIA_HOSTS, {
      production: isProd,
    }),
  },
  async rewrites() {
    // In production nginx proxies /api/v1 and serves /media before a browser request reaches Next;
    // these rewrites cover dev / e2e (no nginx) and the image optimizer's own fetch of /media/*.
    return {
      beforeFiles: officeSiteRewrites(siteRootDomainOf()),
      afterFiles: [
        { source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` },
        { source: '/media/:path*', destination: `${MEDIA_ORIGIN}/media/:path*` },
      ],
    };
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Dev-only / mock routes must never be indexed.
      { source: '/dev/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      {
        source: '/mock-api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
