import { Delta } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatCount, formatDateTime, formatManwon, formatPerPyeong } from '@/lib/format';
import { DATA_SOURCES, SEO_ROUTES, manwonText, ymDot, ymLabel } from '@/lib/seo';
import type { SeoTradeReport } from '@/lib/seo/schemas';
import { reportLead, trendOf, type Trend } from '../lib/facts';
import { KpiRow, Section, SeoHead, SourceNote, seoStyles as styles, type Kpi } from './parts';

function TrendLine({ trends }: { trends: readonly Trend[] }) {
  const shown = trends.filter((t): t is NonNullable<Trend> => t !== null);
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((t) => (
        <Delta key={t.text} direction={t.direction}>
          {t.text}
        </Delta>
      ))}
    </>
  );
}

export interface ReportViewProps {
  report: SeoTradeReport;
  /** Landing path per region code (only indexable 아파트 pages). */
  regionHref: (regionCode: string) => string | null;
}

/** /reports/suncheon-apartment-trades[/YYYYMM] — monthly 아파트 매매 실거래 statistics. */
export function ReportView({ report, regionHref }: ReportViewProps) {
  const { sale, previous, yearAgo } = report;
  const month = ymLabel(report.yearMonth);
  const kpis: Kpi[] = [
    {
      label: '매매 거래량',
      value: formatCount(sale.count),
      unit: '건',
      detail: (
        <TrendLine
          trends={[
            trendOf(sale.count, previous?.sale.count ?? null, '전월 대비'),
            trendOf(sale.count, yearAgo?.sale.count ?? null, '전년 동월 대비'),
          ]}
        />
      ),
    },
  ];
  if (sale.avgPrice !== null) {
    kpis.push({
      label: '평균 거래가',
      value: formatManwon(sale.avgPrice),
      detail: <TrendLine trends={[trendOf(sale.avgPrice, previous?.sale.avgPrice ?? null, '전월 대비')]} />,
    });
  }
  if (sale.medianPrice !== null) {
    kpis.push({
      label: '중위 거래가',
      value: formatManwon(sale.medianPrice),
      detail: (
        <TrendLine trends={[trendOf(sale.medianPrice, previous?.sale.medianPrice ?? null, '전월 대비')]} />
      ),
    });
  }
  if (sale.avgPricePerPyeong !== null) {
    kpis.push({ label: '3.3㎡당 평균 (전용)', value: formatPerPyeong(sale.avgPricePerPyeong) });
  }
  const months = report.availableMonths;

  return (
    <div className={`container ${styles.page}`}>
      <SeoHead
        crumbs={[
          { label: '순천 지역별 시세', href: SEO_ROUTES.regions },
          { label: '아파트 실거래 리포트', href: SEO_ROUTES.report },
          { label: month },
        ]}
        eyebrow={`${report.regionName} 아파트 실거래 월간 리포트`}
        title={`${month} ${report.regionName} 아파트 매매 실거래 동향`}
        lead={reportLead(report)}
        stamp={`집계 대상: ${ymDot(report.yearMonth)} 계약분 · 출처: ${DATA_SOURCES.trades.name}${
          report.syncedAt ? ` · 자료 갱신 ${formatDateTime(report.syncedAt)}` : ''
        }`}
      />

      <KpiRow items={kpis} label={`${month} 거래 요약`} />

      <Section
        id="by-region"
        title="읍면동별 거래"
        count={formatCount(report.byRegion.length)}
        sub="거래가 많은 순서예요. 금액은 만 원 단위이며 해제된 거래는 뺐어요."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{`${month} ${report.regionName} 읍면동별 아파트 매매 실거래 통계`}</caption>
            <thead>
              <tr>
                <th scope="col">법정동</th>
                <th scope="col" className={styles.r}>
                  거래량
                </th>
                <th scope="col" className={styles.r}>
                  평균 거래가
                </th>
                <th scope="col" className={styles.r}>
                  중위 거래가
                </th>
                <th scope="col" className={styles.r}>
                  최저 ~ 최고
                </th>
                <th scope="col" className={styles.r}>
                  3.3㎡당 (전용)
                </th>
              </tr>
            </thead>
            <tbody>
              {report.byRegion.map((r) => {
                const href = r.regionCode ? regionHref(r.regionCode) : null;
                return (
                  <tr key={`${r.regionCode ?? ''}-${r.name}`}>
                    <th scope="row">{href ? <Link href={href}>{r.name}</Link> : <b>{r.name}</b>}</th>
                    <td className={styles.r}>
                      <b>{formatCount(r.sale.count)}</b>건
                    </td>
                    <td className={styles.r}>
                      {r.sale.avgPrice !== null ? formatManwon(r.sale.avgPrice) : '—'}
                    </td>
                    <td className={styles.r}>
                      {r.sale.medianPrice !== null ? formatManwon(r.sale.medianPrice) : '—'}
                    </td>
                    <td className={styles.r}>
                      {r.sale.minPrice !== null && r.sale.maxPrice !== null
                        ? `${formatManwon(r.sale.minPrice)} ~ ${formatManwon(r.sale.maxPrice)}`
                        : '—'}
                    </td>
                    <td className={styles.r}>
                      {r.sale.avgPricePerPyeong !== null
                        ? formatPerPyeong(r.sale.avgPricePerPyeong)
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {report.topComplexes.length > 0 && (
        <Section id="top-complexes" title="거래가 많았던 단지" sub={`${month} 계약 기준 상위 단지`}>
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.narrowTable}`}>
              <caption>{`${month} 거래가 많았던 아파트 단지`}</caption>
              <thead>
                <tr>
                  <th scope="col">단지</th>
                  <th scope="col">법정동</th>
                  <th scope="col" className={styles.r}>
                    거래량
                  </th>
                  <th scope="col" className={styles.r}>
                    중위 거래가
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.topComplexes.map((c) => (
                  <tr key={c.complexId ?? `${c.emdName}-${c.name}`}>
                    <th scope="row">
                      {c.complexId ? (
                        <Link href={ROUTES.complex(c.complexId)}>{c.name}</Link>
                      ) : (
                        <b>{c.name}</b>
                      )}
                    </th>
                    <td>{c.emdName ?? '—'}</td>
                    <td className={styles.r}>{formatCount(c.count)}건</td>
                    <td className={styles.r}>
                      {c.medianPrice !== null ? formatManwon(c.medianPrice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {report.jeonse.count > 0 && (
        <Section id="jeonse" title="같은 달 전세 거래">
          <p className={styles.prose}>
            {month} 아파트 전세 실거래는 {formatCount(report.jeonse.count)}건
            {report.jeonse.medianDeposit !== null &&
              `, 중위 보증금 ${manwonText(report.jeonse.medianDeposit)}`}
            {report.jeonse.avgDeposit !== null &&
              `, 평균 보증금 ${manwonText(report.jeonse.avgDeposit)}`}
            입니다.
          </p>
        </Section>
      )}

      {months.length > 1 && (
        <Section id="months" title="월별 리포트">
          <nav aria-label="월별 리포트" className={styles.chips}>
            {months.map((ym) => {
              const current = ym === report.yearMonth;
              return (
                <Link
                  key={ym}
                  href={ym === report.latestYearMonth ? SEO_ROUTES.report : SEO_ROUTES.reportMonth(ym)}
                  className={current ? `${styles.chip} ${styles.chipCurrent}` : styles.chip}
                  aria-current={current ? 'page' : undefined}
                >
                  {ymDot(ym)}
                </Link>
              );
            })}
          </nav>
        </Section>
      )}

      <SourceNote>
        <p>
          <b>출처</b> {DATA_SOURCES.trades.name} — {DATA_SOURCES.trades.provider}. 원자료는{' '}
          <a href={DATA_SOURCES.trades.lookupUrl} rel="noopener noreferrer" target="_blank">
            {DATA_SOURCES.trades.lookupName}
          </a>
          에서 확인할 수 있어요. {DATA_SOURCES.trades.updateCadence}.
        </p>
        <p>
          <b>집계 방법</b> 계약일이 해당 월인 아파트 매매 신고분을 법정동별로 모았어요. 평균은
          산술평균, 중위는 가운데 값이며 3.3㎡당 가격은 전용면적 기준이에요. 해제 거래{' '}
          {formatCount(sale.cancelledCount)}건은 제외했어요.
        </p>
        <p>{DATA_SOURCES.trades.reportingNote}</p>
        <p>
          <Link href={SEO_ROUTES.regions}>순천 지역별 시세</Link> ·{' '}
          <Link href={SEO_ROUTES.about}>서비스 소개</Link>
        </p>
      </SourceNote>
    </div>
  );
}
