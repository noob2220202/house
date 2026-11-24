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
// Where /media/* is served from when no nginx is in front (dev, e2e). In production nginx serves
// /media from disk before a request reaches Next.
const MEDIA_ORIGIN = (process.env.MEDIA_ORIGIN || API_ORIGIN).replace(/\/$/, '');
const isProd = process.env.NODE_ENV === 'production';

/** Extra absolute media hosts, comma separated: "https://cdn.example.kr,https://media.example.kr". */
const mediaHosts = (process.env.NEXT_PUBLIC_MEDIA_HOSTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((origin) => new URL(origin));

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
  // Keep screenshots clean; build errors still show in the overlay.
  devIndicators: false,
  // Lint runs separately via `pnpm lint` (flat config); don't run it twice during build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { tsconfigPath: nextTsconfig },
  transpilePackages: ['@house/ui'],
  images: {
    // No Next image optimizer: /media images are webp variants the API already generated, served by
    // nginx from disk. `/_next/image` answers 404, so it cannot fail on /media (the optimizer would
    // fetch it from the API, which serves no files) nor be pointed at other loopback paths.
    unoptimized: true,
    // Defense in depth should the optimizer ever be switched back on.
    localPatterns: [{ pathname: '/media/**' }],
    remotePatterns: mediaHosts.map((u) => ({
      protocol: /** @type {'http' | 'https'} */ (u.protocol.replace(':', '')),
      hostname: u.hostname,
      port: u.port,
      pathname: '/media/**',
    })),
  },
  async rewrites() {
    // In production nginx proxies /api/v1 and serves /media before a request reaches Next; these
    // rewrites cover local development and the e2e stack (no nginx).
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
