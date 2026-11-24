import { isValidYearMonth } from '@house/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { SEO_ROUTES } from '@/lib/seo';
import { getSeoRegionIndex, getTradeReport } from '@/lib/seo/api';
import { ReportPageBody, reportMetadata } from '@/features/w-seo/report-page';

type Props = { params: Promise<{ ym: string }> };

/** ISR (1 h). Blocking on-demand render so an unknown month answers a real 404. */
export const revalidate = 3600;
export function generateStaticParams(): { ym: string }[] {
  return [];
}

function parseYm(raw: string): number | null {
  if (!/^\d{6}$/.test(raw)) return null;
  const ym = Number(raw);
  return isValidYearMonth(ym) ? ym : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ym = parseYm((await params).ym);
  const report = ym ? await getTradeReport(ym) : null;
  if (!report) notFound();
  return reportMetadata(report, SEO_ROUTES.reportMonth(report.yearMonth));
}

/** /reports/suncheon-apartment-trades/YYYYMM — one archived month. */
export default async function MonthReportPage({ params }: Props) {
  const ym = parseYm((await params).ym);
  if (!ym) notFound();
  const [report, index] = await Promise.all([
    getTradeReport(ym),
    getSeoRegionIndex().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
  ]);
  if (!report) notFound();
  return <ReportPageBody report={report} index={index} />;
}
