import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Parallel dev servers / builds: every agent uses its own build dir, e.g.
//   NEXT_DIST_DIR=.next-m-core NEXT_PUBLIC_API_MOCK=1 pnpm exec next dev --port 3201
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

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // The back-office must never be indexed or framed.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

// Content-Security-Policy: set per request by src/middleware.ts (script nonce), not here.

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
    return [
      { source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` },
      { source: '/media/:path*', destination: `${MEDIA_ORIGIN}/media/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
