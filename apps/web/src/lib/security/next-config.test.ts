// @vitest-environment node
import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number];
type ConfigModule = {
  default: NextConfig;
  mediaRemotePatterns: (
    csv: string | undefined,
    opts?: { production?: boolean },
  ) => RemotePattern[];
};
const load = async () => {
  const file = '../../../next.config.mjs';
  return (await import(/* @vite-ignore */ file)) as ConfigModule;
};

describe('next.config.mjs (compression, remote images)', () => {
  it('leaves compression to nginx and lists no remote image host by default', async () => {
    const { default: config } = await load();
    expect(config.compress).toBe(false);
    expect(config.images?.remotePatterns).toEqual([]);
  });

  it('remotePatterns: exactly the listed media hosts, under their path, https only in production', async () => {
    const { mediaRemotePatterns } = await load();
    expect(mediaRemotePatterns(undefined, { production: true })).toEqual([]);
    expect(
      mediaRemotePatterns(' https://cdn.example.kr/media/ , http://media.example.kr:8080', {
        production: true,
      }),
    ).toEqual([
      {
        protocol: 'https',
        hostname: 'cdn.example.kr',
        port: '',
        pathname: '/media/**',
        search: '',
      },
    ]);
    expect(mediaRemotePatterns('http://media.example.kr:8080')).toEqual([
      { protocol: 'http', hostname: 'media.example.kr', port: '8080', pathname: '/**', search: '' },
    ]);
  });
});

type Rewrite = {
  source: string;
  destination: string;
  has?: { type: string; value: string }[];
  missing?: { type: string; value: string }[];
};
type SiteModule = {
  officeSiteRewrites: (root: string) => Rewrite[];
  siteRootDomainOf: (env: Record<string, string | undefined>) => string;
};

/** Next's own `has`/`missing` host test: the value is a full-match regex on the hostname. */
const hostMatches = (value: string, host: string) => new RegExp(`^${value}$`).exec(host);

describe('next.config.mjs office-site rewrites (config rewrites, not middleware rewrites)', () => {
  const site = async () => (await load()) as unknown as SiteModule;

  it('derives the root domain like env.siteRootDomain', async () => {
    const { siteRootDomainOf } = await site();
    expect(siteRootDomainOf({ NEXT_PUBLIC_SITE_URL: 'https://suncheonmap.kr' })).toBe(
      'suncheonmap.kr',
    );
    expect(siteRootDomainOf({ NEXT_PUBLIC_SITE_ROOT_DOMAIN: 'Example.KR.' })).toBe('example.kr');
    expect(siteRootDomainOf({})).toBe('localhost');
  });

  it('maps the office pages of <slug>.<root> and captures the slug', async () => {
    const rules = (await site()).officeSiteRewrites('suncheonmap.kr');
    const home = rules.find((r) => r.source === '/' && r.has)!;
    expect(home.destination).toBe('/office-site/:slug');
    const m = hostMatches(home.has![0]!.value, 'sindae.suncheonmap.kr');
    expect(m?.groups?.slug).toBe('sindae');
    for (const host of ['suncheonmap.kr', 'a.b.suncheonmap.kr', 'sindae.suncheonmap.kr.evil.com']) {
      expect(hostMatches(home.has![0]!.value, host)).toBeNull();
    }
    expect(rules.map((r) => r.destination)).toEqual(
      expect.arrayContaining([
        '/office-site/:slug/listing/:id',
        '/office-site/:slug/robots.txt',
        '/office-site/:slug/sitemap.xml',
      ]),
    );
  });

  it('hides /office-site/* on the main host only', async () => {
    const rules = (await site()).officeSiteRewrites('suncheonmap.kr');
    const hide = rules.filter((r) => r.destination === '/_not-found-office-site');
    expect(hide.map((r) => r.source)).toEqual(['/office-site', '/office-site/:path*']);
    for (const r of hide) {
      const officeHost = r.missing![0]!.value;
      expect(hostMatches(officeHost, 'suncheonmap.kr')).toBeNull(); // main host → rule applies
      expect(hostMatches(officeHost, 'sindae.suncheonmap.kr')).not.toBeNull(); // office → skipped
    }
  });

  it('wires them in beforeFiles (they must win over the main-site pages)', async () => {
    const { default: config } = await load();
    const rewrites = (await config.rewrites!()) as { beforeFiles: Rewrite[] };
    expect(rewrites.beforeFiles.some((r) => r.destination === '/office-site/:slug')).toBe(true);
  });
});
