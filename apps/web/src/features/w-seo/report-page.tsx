import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { EmptyState } from '@house/ui';
import { ReportView } from './components/ReportView';
import { seoStyles } from './components/parts';
import { reportLead } from './lib/facts';
import {
  JsonLd,
  SEO_ROUTES,
  breadcrumbJsonLd,
  buildMetadata,
  datasetJsonLd,
  indexableLandings,
  ymLabel,
} from '@/lib/seo';
import type { SeoRegionIndex, SeoTradeReport } from '@/lib/seo/schemas';
import { DATA_SOURCES } from '@/lib/seo/sources';

/*
 * Shared by /reports/suncheon-apartment-trades (latest month) and /…/[ym] (archive). The latest
 * month's archive URL canonicalizes to the bare path, so each month has exactly one indexed URL.
 */

export const reportPath = (report: SeoTradeReport) =>
  report.yearMonth === report.latestYearMonth
    ? SEO_ROUTES.report
    : SEO_ROUTES.reportMonth(report.yearMonth);

export function reportTitle(report: SeoTradeReport): string {
  return `${ymLabel(report.yearMonth)} ${BRAND.seo.regionShort} 아파트 실거래가 동향 · 거래량과 평균·중위 가격`;
}

export function reportMetadata(report: SeoTradeReport, path: string): Metadata {
  return buildMetadata({
    title: reportTitle(report),
    description: reportLead(report).join(' '),
    path,
    canonicalPath: reportPath(report),
    type: 'article',
  });
}

export function ReportPageBody({
  report,
  index,
}: {
  report: SeoTradeReport;
  index: SeoRegionIndex | null;
}) {
  const apt = new Map(
    (index ? indexableLandings(index.regions) : [])
      .filter((l) => l.asset === 'apt')
      .map((l) => [l.region.code, SEO_ROUTES.region(l.region, 'apt')]),
  );
  const path = reportPath(report);
  const month = ymLabel(report.yearMonth);
  const ym = `${Math.floor(report.yearMonth / 100)}-${String(report.yearMonth % 100).padStart(2, '0')}`;
  return (
    <>
      <JsonLd
        data={[
          datasetJsonLd({
            path,
            name: `${month} ${report.regionName} 아파트 매매 실거래 통계`,
            description: reportLead(report).join(' '),
            temporalCoverage: ym,
            dateModified: report.syncedAt ?? report.updatedAt,
            source: { name: DATA_SOURCES.trades.name, url: DATA_SOURCES.trades.url },
            variables: ['거래량', '평균 거래가(만 원)', '중위 거래가(만 원)', '전용면적 3.3㎡당 평균 거래가(만 원)'],
            keywords: [`${BRAND.seo.regionShort} 아파트 실거래가`, `${BRAND.seo.regionShort} 아파트 거래량`, month],
          }),
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '순천 지역별 시세', path: SEO_ROUTES.regions },
            { name: `${month} 아파트 실거래 리포트`, path },
          ]),
        ]}
      />
      <ReportView report={report} regionHref={(code) => apt.get(code) ?? null} />
    </>
  );
}

/** No trade data synced yet (fresh install): a noindex placeholder instead of a 404. */
export function ReportEmpty() {
  return (
    <div className={`container ${seoStyles.empty}`}>
      <EmptyState
        icon="chart"
        title="아직 집계된 실거래 자료가 없어요"
        description="국토교통부 실거래가 자료를 받아 오면 월간 리포트가 열려요."
      />
    </div>
  );
}
