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
// Where /media/* is served from when no nginx is in front (dev, e2e). In production nginx serves
// /media from disk before a request reaches Next.
const MEDIA_ORIGIN = (process.env.MEDIA_ORIGIN || API_ORIGIN).replace(/\/$/, '');
const isProd = process.env.NODE_ENV === 'production';

/** Extra absolute media hosts, comma separated: "https://cdn.example.kr,https://media.example.kr". */
const mediaHosts = parseOrigins(process.env.NEXT_PUBLIC_MEDIA_HOSTS);

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
  // Keep screenshots clean; build errors still show in the overlay.
  devIndicators: false,
  // Lint runs separately via `pnpm lint` (flat config); don't run it twice during build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { tsconfigPath: nextTsconfig },
  transpilePackages: ['@house/ui'],
  images: {
    // No Next image optimizer: every /media image is already a webp variant the API generated
    // (thumb 320 / medium 960 / large 1920) and nginx serves it from disk with long cache headers.
    // `/_next/image` answers 404, so it can neither fail on /media (the optimizer would fetch it
    // from the API, which serves no files) nor be pointed at other loopback paths.
    unoptimized: true,
    // Defense in depth should the optimizer ever be switched back on: only /media and the
    // configured media hosts' /media paths.
    localPatterns: [{ pathname: '/media/**' }],
    remotePatterns: mediaHosts.map((origin) => {
      const u = new URL(origin);
      return {
        protocol: /** @type {'http' | 'https'} */ (u.protocol.replace(':', '')),
        hostname: u.hostname,
        port: u.port,
        pathname: '/media/**',
      };
    }),
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
