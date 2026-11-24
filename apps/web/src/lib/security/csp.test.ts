// @vitest-environment node
import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, parseOrigins } from '../../../csp.mjs';

const directives = (policy: string) =>
  new Map(
    policy.split(';').map((d) => {
      const [name = '', ...values] = d.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );

describe('user-site Content-Security-Policy (csp.mjs)', () => {
  const prod = directives(contentSecurityPolicy());

  it('pins every external script the site loads', () => {
    const script = prod.get('script-src') ?? [];
    expect(script).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://oapi.map.naver.com', // Naver Maps JS v3
        'https://t1.kakaocdn.net', // Kakao 우편번호 (default host)
        'https://t1.daumcdn.net', // its retired host
      ]),
    );
    expect(script).not.toContain("'unsafe-eval'");
    expect(script.some((s) => s === '*' || s === 'https:' || s === 'http:')).toBe(false);
  });

  it('allows the postcode and YouTube iframes, and nothing can frame or plug in', () => {
    expect(prod.get('frame-src')).toEqual(
      expect.arrayContaining([
        'https://postcode.map.kakao.com',
        'https://postcode.map.daum.net',
        'https://www.youtube-nocookie.com',
      ]),
    );
    expect(prod.get('object-src')).toEqual(["'none'"]);
    expect(prod.get('base-uri')).toEqual(["'self'"]);
    expect(prod.get('frame-ancestors')).toEqual(["'self'"]);
    expect(prod.get('default-src')).toEqual(["'self'"]);
  });

  it('adds an overridden postcode script origin, media hosts and dev-only eval', () => {
    const p = directives(
      contentSecurityPolicy({
        dev: true,
        mediaHosts: parseOrigins(' https://cdn.example.kr/media/ ,'),
        postcodeScriptUrl: 'https://postcode.example.kr/v2/postcode.js',
      }),
    );
    expect(p.get('script-src')).toEqual(
      expect.arrayContaining(["'unsafe-eval'", 'https://postcode.example.kr']),
    );
    expect(p.get('img-src')).toContain('https://cdn.example.kr');
  });
});

describe('next.config.mjs', () => {
  it('enforces the CSP (not Report-Only) and disables the image optimizer', async () => {
    const file = '../../../next.config.mjs';
    const config = ((await import(/* @vite-ignore */ file)) as { default: NextConfig }).default;
    const rules = (await config.headers?.()) ?? [];
    const all = rules.find((r) => r.source === '/:path*')?.headers ?? [];
    const csp = all.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain('script-src ');
    expect(all.some((h) => /report-only/i.test(h.key))).toBe(false);

    expect(config.images?.unoptimized).toBe(true);
    expect(config.images?.localPatterns).toEqual([{ pathname: '/media/**' }]);
    // No loopback API host: the optimizer must never be able to fetch the API's other paths.
    for (const p of config.images?.remotePatterns ?? []) {
      expect(p instanceof URL ? p.pathname : p.pathname).toBe('/media/**');
    }
  });
});
