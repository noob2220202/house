import { expect, test, type APIRequestContext } from 'playwright/test';
import { activeListingWithHo, anyComplexListing, Api, apiSessionAs } from '../../lib/api';
import { SEED, WEB_URL } from '../../lib/env';

/**
 * Search / AI crawlers read the server HTML only: every SEO page must carry its H1, canonical
 * link and JSON-LD in the response body itself (view-source), with no client JavaScript run.
 */
interface ServerHtml {
  html: string;
  h1: string[];
  canonical: string | null;
  jsonLd: unknown[];
}

async function serverHtml(request: APIRequestContext, path: string): Promise<ServerHtml> {
  const res = await request.get(`${WEB_URL}${path}`, { headers: { accept: 'text/html' } });
  expect(res.status(), `${path} → ${res.status()}`).toBe(200);
  expect(res.headers()['content-type']).toContain('text/html');
  const html = await res.text();
  const text = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]!));
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1] ?? null;
  const jsonLd = [
    ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]!) as unknown);
  return { html, h1, canonical, jsonLd };
}

/** Every `@type` anywhere in the JSON-LD blocks (graphs and nested nodes included). */
function ldTypes(blocks: unknown[]): Set<string> {
  const types = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const t = (v as Record<string, unknown>)['@type'];
      if (typeof t === 'string') types.add(t);
      if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.add(x));
      Object.values(v).forEach(walk);
    }
  };
  walk(blocks);
  return types;
}

function expectSeo(page: ServerHtml, path: string, opts: { h1: RegExp | string; types: string[] }) {
  expect(page.h1, `${path}: exactly one server-rendered H1`).toHaveLength(1);
  if (typeof opts.h1 === 'string') expect(page.h1[0]).toBe(opts.h1);
  else expect(page.h1[0]).toMatch(opts.h1);
  expect(page.canonical, `${path}: canonical`).toBe(
    new URL(path, WEB_URL).toString().replace(/\/$/, ''),
  );
  const types = ldTypes(page.jsonLd);
  for (const t of opts.types) expect([...types], `${path}: JSON-LD ${t}`).toContain(t);
}

test.describe('SEO pages render server-side', () => {
  test('home, region index, landing, report and about carry H1 + JSON-LD in the HTML', async ({
    request,
  }) => {
    expectSeo(await serverHtml(request, '/'), '/', {
      h1: /\S/,
      types: ['Organization', 'WebSite', 'SearchAction'],
    });

    const index = await serverHtml(request, '/suncheon');
    expectSeo(index, '/suncheon', { h1: /지역별/, types: ['BreadcrumbList', 'ItemList'] });
    // The index links the indexable 지역 × 매물 종류 landings; the first one renders too.
    const landing = /href="(\/suncheon\/[^"/]+\/[a-z]+)"/.exec(index.html)?.[1];
    expect(landing, '/suncheon links at least one landing page').toBeTruthy();
    expectSeo(await serverHtml(request, landing!), landing!, {
      h1: /^순천 /,
      types: ['BreadcrumbList', 'Place'],
    });

    expectSeo(
      await serverHtml(request, '/reports/suncheon-apartment-trades'),
      '/reports/suncheon-apartment-trades',
      { h1: /실거래/, types: ['Dataset', 'BreadcrumbList'] },
    );
    expectSeo(await serverHtml(request, '/about'), '/about', {
      h1: /서비스 소개/,
      types: ['Organization', 'AboutPage'],
    });
  });

  test('complex and listing pages: H1, JSON-LD, 명시사항 in the HTML, never the 호', async ({
    request,
    playwright,
  }) => {
    const broker = await apiSessionAs(playwright, SEED.ownerA1);
    const withHo = await activeListingWithHo(broker.api);
    await broker.dispose();

    const listingPath = `/listing/${withHo.id}`;
    const listing = await serverHtml(request, listingPath);
    expectSeo(listing, listingPath, { h1: /\S/, types: ['RealEstateListing', 'Offer'] });
    // 공인중개사법 표시·광고 명시사항 is part of the server HTML, not added by the client.
    expect(listing.html).toContain('중개대상물 표시·광고 명시사항');
    // The private 호 never reaches the HTML or the structured data.
    expect(JSON.stringify(listing.jsonLd)).not.toContain(`${withHo.property.ho}호`);
    expect(listing.html).not.toContain(`${withHo.property.ho}호`);

    const api = new Api(request);
    const target = await anyComplexListing(api);
    const complexPath = `/complex/${target.complex!.id}`;
    expectSeo(await serverHtml(request, complexPath), complexPath, {
      h1: target.complex!.name,
      types: ['ApartmentComplex'],
    });
  });

  test('sitemap, robots and llms.txt are served', async ({ request }) => {
    const sitemap = await request.get(`${WEB_URL}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toMatch(/<(urlset|sitemapindex)[\s>]/);
    const robots = await request.get(`${WEB_URL}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/Sitemap: /i);
    const llms = await request.get(`${WEB_URL}/llms.txt`);
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toContain('순천부동산지도');
  });
});
