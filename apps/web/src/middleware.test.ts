import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { env } from '@/config/env';
import { middleware } from './middleware';

// Production-like origins: main site https://suncheonmap.kr, office sites https://<slug>.suncheonmap.kr.
vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/env')>();
  return {
    env: { ...actual.env, siteUrl: 'https://suncheonmap.kr', siteRootDomain: 'suncheonmap.kr' },
  };
});

// Behind nginx the Next server sees its own address (https://localhost:3000); a redirect built from
// req.nextUrl would send visitors to localhost (live bug). The login redirect must be relative.
const req = (path: string, cookie?: string) =>
  new NextRequest(`https://localhost:3000${path}`, {
    headers: {
      host: 'suncheonmap.kr',
      'x-forwarded-proto': 'https',
      ...(cookie ? { cookie } : {}),
    },
  });

/** Internal path a `NextResponse.rewrite()` points at (null = no rewrite). */
const rewrittenTo = (res: Response) => {
  const to = res.headers.get('x-middleware-rewrite');
  if (!to) return null;
  const url = new URL(to);
  return `${url.pathname}${url.search}`;
};
const passedThrough = (res: Response) =>
  res.headers.get('x-middleware-next') === '1' && !res.headers.get('location');

describe('web middleware', () => {
  it('redirects a protected page to a relative /login without leaking the internal host', () => {
    const res = middleware(req('/deal/sell'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://suncheonmap.kr/login?returnTo=%2Fdeal%2Fsell',
    );
  });

  it('keeps the query string in returnTo', () => {
    const res = middleware(req('/me/requests?tab=closed'));
    expect(res.headers.get('location')).toBe(
      'https://suncheonmap.kr/login?returnTo=%2Fme%2Frequests%3Ftab%3Dclosed',
    );
  });

  it('lets a request with the session cookie through', () => {
    const res = middleware(req('/me', 'house_sid=abc'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('falls back to the request origin when Host is missing or malformed', () => {
    const bad = new NextRequest('https://localhost:3000/me', { headers: { host: 'evil.com/x' } });
    expect(new URL(middleware(bad).headers.get('location') ?? '').host).toBe('localhost:3000');
  });

  it('serves public pages of the main host untouched', () => {
    expect(passedThrough(middleware(req('/')))).toBe(true);
    expect(passedThrough(middleware(req('/listing/abc')))).toBe(true);
    expect(passedThrough(middleware(req('/agency/abc')))).toBe(true);
  });

  it('hides the internal office-site routes on the main host (404 page)', () => {
    for (const path of ['/office-site', '/office-site/sindae', '/office-site/sindae/listing/1']) {
      const res = middleware(req(path));
      expect(rewrittenTo(res)).toBe('/_not-found-office-site');
      expect(res.headers.get('location')).toBeNull();
    }
    // Only the exact prefix: an unrelated path starting with the same letters is a normal page.
    expect(passedThrough(middleware(req('/office-sites')))).toBe(true);
  });

  describe('office host <slug>.suncheonmap.kr', () => {
    const office = (path: string, extra?: Record<string, string>) =>
      new NextRequest(`https://localhost:3000${path}`, {
        headers: { host: 'localhost:3000', 'x-forwarded-proto': 'https', ...extra },
      });
    const at = (path: string) => office(path, { 'x-forwarded-host': 'sindae.suncheonmap.kr' });

    it('rewrites the office pages to the internal routes (query kept)', () => {
      expect(rewrittenTo(middleware(at('/')))).toBe('/office-site/sindae');
      expect(rewrittenTo(middleware(at('/?type=APT&page=2')))).toBe(
        '/office-site/sindae?type=APT&page=2',
      );
      expect(rewrittenTo(middleware(at('/listing/0b6f2c1e-0000-4000-8000-0000000000b1')))).toBe(
        '/office-site/sindae/listing/0b6f2c1e-0000-4000-8000-0000000000b1',
      );
      expect(rewrittenTo(middleware(at('/robots.txt')))).toBe('/office-site/sindae/robots.txt');
      expect(rewrittenTo(middleware(at('/sitemap.xml')))).toBe('/office-site/sindae/sitemap.xml');
    });

    it('reads the Host header when there is no X-Forwarded-Host (dev: <slug>.localhost)', () => {
      const res = middleware(
        new NextRequest('http://sindae.suncheonmap.kr/', {
          headers: { host: 'sindae.suncheonmap.kr' },
        }),
      );
      expect(rewrittenTo(res)).toBe('/office-site/sindae');
    });

    it('lowercases the host label', () => {
      expect(rewrittenTo(middleware(office('/', { host: 'SinDae.SuncheonMap.kr' })))).toBe(
        '/office-site/sindae',
      );
    });

    it('passes assets, the API / media proxies, the mock API and icons through', () => {
      for (const path of [
        '/_next/static/chunks/main.js',
        '/api/v1/sites/sindae',
        '/media/a/b.webp',
        '/mock-api/v1/sites/sindae',
        '/icons/icon-192.png',
        '/favicon.ico',
        '/manifest.webmanifest',
      ]) {
        expect(passedThrough(middleware(at(path)))).toBe(true);
      }
    });

    it('sends every other path to the same path on the main site (307)', () => {
      for (const [path, location] of [
        ['/agency/abc', 'https://suncheonmap.kr/agency/abc'],
        ['/map/apt?c=1,2', 'https://suncheonmap.kr/map/apt?c=1,2'],
        ['/login?returnTo=%2F', 'https://suncheonmap.kr/login?returnTo=%2F'],
        ['/listing/abc/extra', 'https://suncheonmap.kr/listing/abc/extra'],
        ['/office-site/other', 'https://suncheonmap.kr/office-site/other'],
      ] as const) {
        const res = middleware(at(path));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe(location);
      }
    });

    it('sends protected pages to the main site instead of the office host login', () => {
      const res = middleware(at('/me'));
      expect(res.headers.get('location')).toBe('https://suncheonmap.kr/me');
    });

    it('dev (main site = this server): hands the redirect to the to-main route instead', () => {
      const saved = env.siteUrl;
      Object.assign(env, { siteUrl: 'https://localhost:3000' });
      try {
        const res = middleware(at('/agency/abc?x=1'));
        expect(rewrittenTo(res)).toBe('/office-site/sindae/to-main');
        expect(res.headers.get('x-middleware-request-x-house-to-main')).toBe('/agency/abc?x=1');
        expect(res.headers.get('location')).toBeNull();
      } finally {
        Object.assign(env, { siteUrl: saved });
      }
    });

    it('treats reserved, malformed and nested labels as the main site', () => {
      for (const host of [
        'www.suncheonmap.kr',
        'admin.suncheonmap.kr',
        'xn--abc.suncheonmap.kr',
        'a.b.suncheonmap.kr',
        'ab.suncheonmap.kr',
        'suncheonmap.kr.evil.com',
      ]) {
        const res = middleware(office('/', { 'x-forwarded-host': host }));
        expect(passedThrough(res)).toBe(true);
      }
    });
  });
});
