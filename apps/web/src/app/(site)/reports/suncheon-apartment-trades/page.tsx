import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ApiError } from '@/lib/api/errors';
import { SEO_ROUTES, buildMetadata } from '@/lib/seo';
import { getSeoRegionIndex, getTradeReport } from '@/lib/seo/api';
import { ReportEmpty, ReportPageBody, reportMetadata } from '@/features/w-seo/report-page';

/*
 * Rendered per request (`connection()`): a build-time prerender would bake in an empty page (no
 * API during `next build`) for a whole revalidate window. The API reads stay in the Next data
 * cache (lib/seo/api revalidate windows) and the API caches them in Redis.
 */

const indexOrNull = () =>
  getSeoRegionIndex().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const report = await getTradeReport();
  if (!report) {
    return buildMetadata({
      title: '순천 아파트 실거래 리포트',
      path: SEO_ROUTES.report,
      noindex: 'follow',
    });
  }
  return reportMetadata(report, SEO_ROUTES.report);
}

/** /reports/suncheon-apartment-trades — the latest reported month. */
export default async function LatestReportPage() {
  await connection();
  const [report, index] = await Promise.all([getTradeReport(), indexOrNull()]);
  if (!report) return <ReportEmpty />;
  return <ReportPageBody report={report} index={index} />;
}
