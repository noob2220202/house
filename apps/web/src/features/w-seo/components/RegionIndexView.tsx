import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { formatCount, formatDateKorean } from '@/lib/format';
import {
  DATA_SOURCES,
  LANDING_ASSETS,
  LANDING_ASSET_SLUGS,
  SEO_ROUTES,
  landingCounts,
  landingDecision,
  placeLabel,
  ymDot,
} from '@/lib/seo';
import type { SeoRegionIndex } from '@/lib/seo/schemas';
import { KpiRow, Section, SeoHead, SourceNote, seoStyles as styles } from './parts';

/** "순천 지역별 시세" — every 읍면동/리 with data and links to its indexable landing pages. */
export function RegionIndexView({ index }: { index: SeoRegionIndex }) {
  const regions = index.regions;
  // 읍·면 rows already include their 리 — count a 리 only when its 읍·면 is not listed.
  const codes = new Set(regions.map((r) => r.code));
  const top = regions.filter((r) => r.code.length === 8 || !codes.has(r.code.slice(0, 8)));
  const totalListings = top.reduce(
    (n, r) => n + Object.values(r.listingCounts).reduce((a, b) => a + b, 0),
    0,
  );
  const totalTrades = top.reduce((n, r) => n + r.saleTradeCount, 0);
  const { fromYm, toYm } = index.tradePeriod;

  return (
    <div className={`container ${styles.page}`}>
      <SeoHead
        crumbs={[{ label: '순천 지역별 시세' }]}
        eyebrow={BRAND.regionFull}
        title={`${BRAND.seo.regionShort} 지역별 부동산 시세`}
        lead={[
          `${BRAND.region} 읍면동·지구별로 ${BRAND.name}에 등록된 매물 수와 최근 12개월(${ymDot(fromYm)}~${ymDot(toYm)}) 국토교통부 아파트 매매 실거래 건수를 모았습니다. 지역과 매물 종류를 고르면 단지별 시세, 최근 실거래가, 매물 호가를 볼 수 있습니다.`,
        ]}
        stamp={`${formatDateKorean(index.updatedAt)} 기준`}
      />

      <KpiRow
        label={`${BRAND.region} 요약`}
        items={[
          { label: '데이터가 있는 지역', value: formatCount(regions.length), unit: '곳' },
          { label: '공개 매물', value: formatCount(totalListings), unit: '건' },
          { label: '아파트 매매 실거래 (12개월)', value: formatCount(totalTrades), unit: '건' },
        ]}
      />

      <Section
        id="regions"
        title="읍면동·지구별 매물"
        count={formatCount(regions.length)}
        sub="숫자를 누르면 그 지역·매물 종류의 시세 페이지로 이동해요. 매물이 적은 곳은 숫자만 보여 드려요."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{`${BRAND.region} 읍면동별 매물 수와 아파트 실거래 건수`}</caption>
            <thead>
              <tr>
                <th scope="col">지역</th>
                {LANDING_ASSET_SLUGS.map((a) => (
                  <th key={a} scope="col" className={styles.r}>
                    {LANDING_ASSETS[a].noun}
                  </th>
                ))}
                <th scope="col" className={styles.r}>
                  아파트 실거래
                </th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.code}>
                  <th scope="row">
                    <b>{r.emdName}</b>
                    {placeLabel(r) !== r.emdName && <small>{placeLabel(r)}</small>}
                  </th>
                  {LANDING_ASSET_SLUGS.map((a) => {
                    const n = landingCounts(r, a).listings;
                    const decision = landingDecision(regions, r, a);
                    return (
                      <td key={a} className={styles.r}>
                        {decision.kind === 'index' ? (
                          <Link
                            href={SEO_ROUTES.region(r, a)}
                            aria-label={`${r.emdName} ${LANDING_ASSETS[a].noun} 시세 (매물 ${n}건)`}
                          >
                            {formatCount(n)}
                          </Link>
                        ) : n > 0 ? (
                          formatCount(n)
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                  <td className={styles.r}>
                    {r.saleTradeCount > 0 ? `${formatCount(r.saleTradeCount)}건` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <SourceNote>
        <p>
          <b>집계 기준</b> 매물: 광고 중·계약 중인 공개 매물. 읍·면 행은 그 아래 리를 포함해요.
          실거래: {DATA_SOURCES.trades.name}, 최근 12개월 매매(해제 거래 제외).
        </p>
        <p>
          <Link href={SEO_ROUTES.report}>순천 아파트 실거래 월간 리포트</Link> ·{' '}
          <Link href={SEO_ROUTES.about}>서비스 소개</Link>
        </p>
      </SourceNote>
    </div>
  );
}
