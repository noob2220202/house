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
        'https://dapi.kakao.com', // Kakao Maps loader (sdk.js)
        'https://t1.kakaocdn.net', // Kakao 우편번호 (default host)
        'https://t1.daumcdn.net', // its retired host
      ]),
    );
    expect(script).not.toContain("'unsafe-eval'");
    // The Naver map is gone (D13): no Naver script / connect host is left.
    expect(prod.get('script-src')?.some((s) => /naver|pstatic|ntruss/.test(s))).toBe(false);
    expect(prod.get('connect-src')?.some((s) => /naver|pstatic|ntruss/.test(s))).toBe(false);
    expect(script.some((s) => s === '*' || s === 'https:' || s === 'http:')).toBe(false);
  });

  it('allows the Kakao map tiles and SDK sprites as images', () => {
    expect(prod.get('img-src')).toEqual(expect.arrayContaining(['https://*.daumcdn.net']));
    // The map core (t1.daumcdn.net/mapjsapi/js/main/…/kakao.js) is a script.
    expect(prod.get('script-src')).toContain('https://t1.daumcdn.net');
    expect(prod.get('connect-src')).toEqual(["'self'"]);
  });

  it('allows the postcode and YouTube iframes, and nothing can frame or plug in', () => {
    expect(prod.get('frame-src')).toEqual(
      expect.arrayContaining([
        'postcode.map.kakao.com',
        'postcode.map.daum.net',
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
  it('enforces the CSP (not Report-Only); the optimizer fetches /media only', async () => {
    const file = '../../../next.config.mjs';
    const config = ((await import(/* @vite-ignore */ file)) as { default: NextConfig }).default;
    const rules = (await config.headers?.()) ?? [];
    const all = rules.find((r) => r.source === '/:path*')?.headers ?? [];
    const csp = all.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain('script-src ');
    expect(all.some((h) => /report-only/i.test(h.key))).toBe(false);

    // The optimizer may fetch local /media (and the mock stand-ins) only — no API path, and no
    // loopback API host (it could otherwise be pointed at any path on the API's port).
    expect(config.images?.unoptimized).toBeFalsy();
    expect(config.images?.localPatterns).toEqual([
      { pathname: '/media/**' },
      { pathname: '/mock-api/**' },
    ]);
    for (const p of config.images?.remotePatterns ?? []) {
      const host = p instanceof URL ? p.hostname : p.hostname;
      expect(['localhost', '127.0.0.1', '::1', '[::1]']).not.toContain(host);
    }
    const rewrites = (await config.rewrites?.()) as {
      afterFiles: { source: string; destination: string }[];
    };
    const media = rewrites.afterFiles.find((r) => r.source === '/media/:path*');
    expect(media?.destination).toMatch(/\/media\/:path\*$/);
  });
});
