import type { MetadataRoute } from 'next';
import { ROUTES } from '@/config/nav';
import { absoluteUrl } from './metadata';
import { SEO_ROUTES, indexableLandings, type LandingCounts } from './regions';
import type { SeoRegionIndex, SeoSitemap } from './schemas';

export type SitemapEntry = MetadataRoute.Sitemap[number];

/**
 * The sitemap index (/sitemap.xml) lists one file per kind of page. Each is a Next metadata route
 * (`src/app/sitemaps/<name>/sitemap.ts` → `/sitemaps/<name>/sitemap.xml`).
 */
export const SITEMAP_FILES = ['static', 'regions', 'complexes', 'listings', 'agencies'] as const;
export type SitemapFile = (typeof SITEMAP_FILES)[number];
export const sitemapFilePath = (name: SitemapFile) => `/sitemaps/${name}/sitemap.xml`;

const xmlEscape = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c,
  );

/** `<sitemapindex>` XML; `lastmod` per file when known. */
export function sitemapIndexXml(files: readonly { path: string; lastModified?: Date | null }[]) {
  const rows = files
    .map(
      (f) =>
        `  <sitemap>\n    <loc>${xmlEscape(absoluteUrl(f.path))}</loc>\n${
          f.lastModified ? `    <lastmod>${f.lastModified.toISOString()}</lastmod>\n` : ''
        }  </sitemap>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</sitemapindex>\n`;
}

const MAP_ASSETS = ['apt', 'oneroom', 'house', 'commercial', 'land'] as const;

/** Pages that always exist. No `lastModified`: we do not know when they last changed. */
export function staticEntries(policyPaths: readonly string[] = []): SitemapEntry[] {
  const entry = (
    path: string,
    changeFrequency: SitemapEntry['changeFrequency'],
    priority: number,
  ): SitemapEntry => ({ url: absoluteUrl(path), changeFrequency, priority });
  return [
    entry(ROUTES.home, 'hourly', 1),
    ...MAP_ASSETS.map((asset) => entry(ROUTES.map(asset), 'hourly', 0.9)),
    entry(SEO_ROUTES.regions, 'daily', 0.8),
    entry(ROUTES.agencies, 'daily', 0.8),
    entry(SEO_ROUTES.about, 'monthly', 0.6),
    entry(ROUTES.deal, 'monthly', 0.7),
    entry(ROUTES.community, 'daily', 0.6),
    entry(ROUTES.videos, 'weekly', 0.6),
    entry(ROUTES.tools, 'monthly', 0.6),
    entry(ROUTES.notices, 'weekly', 0.5),
    entry(ROUTES.faq, 'monthly', 0.5),
    entry(ROUTES.support, 'monthly', 0.4),
    ...policyPaths.map((p) => entry(p, 'yearly', 0.3)),
  ];
}

/** Monthly report: the latest month (bare path) + every archived month. */
export function reportEntries(
  report: {
    latestYearMonth: number;
    availableMonths: readonly number[];
    syncedAt: string | null;
  } | null,
): SitemapEntry[] {
  if (!report) return [];
  const archived = report.availableMonths.filter((ym) => ym !== report.latestYearMonth);
  return [
    {
      url: absoluteUrl(SEO_ROUTES.report),
      // When the latest month was last synced from 국토교통부 (not when the API computed it).
      lastModified: report.syncedAt ? new Date(report.syncedAt) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...archived.map(
      (ym): SitemapEntry => ({
        url: absoluteUrl(SEO_ROUTES.reportMonth(ym)),
        changeFrequency: 'monthly',
        priority: 0.4,
      }),
    ),
  ];
}

const priorityOf = (c: LandingCounts) =>
  c.listings >= 20 || c.trades >= 50 ? 0.8 : c.listings >= 5 || c.trades >= 10 ? 0.7 : 0.6;

/** Indexable landing pages only (thin / duplicate ones are left out, like their noindex). */
export function regionEntries(index: SeoRegionIndex): SitemapEntry[] {
  return indexableLandings(index.regions).map(({ region, asset, counts }) => ({
    url: absoluteUrl(SEO_ROUTES.region(region, asset)),
    lastModified: region.lastModified ? new Date(region.lastModified) : undefined,
    changeFrequency: 'daily',
    priority: priorityOf(counts),
  }));
}

/** Rows of GET /seo/sitemap/:kind → entries. */
export function rowEntries(
  rows: SeoSitemap,
  toPath: (id: string) => string,
  options: Pick<SitemapEntry, 'changeFrequency' | 'priority'>,
): SitemapEntry[] {
  return rows.items.map((row) => {
    const date = new Date(row.lastModified);
    return {
      url: absoluteUrl(toPath(row.id)),
      lastModified: Number.isNaN(date.getTime()) ? undefined : date,
      ...options,
    };
  });
}

/** Newest `lastModified` of a set of entries (lastmod of the file in the index). */
export function newestOf(entries: readonly SitemapEntry[]): Date | null {
  let best: Date | null = null;
  for (const e of entries) {
    const d = e.lastModified ? new Date(e.lastModified) : null;
    if (d && !Number.isNaN(d.getTime()) && (!best || d > best)) best = d;
  }
  return best;
}
