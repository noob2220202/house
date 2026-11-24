import { DEAL_TYPE_LABEL, DealType } from '@house/shared';
import { Button, Icon, dealKindOf } from '@house/ui';
import Link from 'next/link';
import type { MapAssetSlug } from '@/config/nav';
import { ROUTES } from '@/config/nav';
import type { ListingSummary } from '@/lib/api/schemas/listing';
import { listingDisplayName } from '@/lib/api/schemas/listing';
import {
  formatBuiltYear,
  formatCount,
  formatDateKorean,
  formatDealPriceLabeled,
  formatManwon,
  formatPerPyeong,
  formatPriceRange,
  formatSqm,
} from '@/lib/format';
import { DATA_SOURCES, LANDING_ASSETS, SEO_ROUTES, landingTitle, ymDot } from '@/lib/seo';
import type { SeoDealSummary, SeoRegionLanding } from '@/lib/seo/schemas';
import { landingIntro, placeFull, tradeSpec } from '../lib/facts';
import { KpiRow, Section, SeoHead, SourceNote, seoStyles as styles, type Kpi } from './parts';

export interface LandingLink {
  href: string;
  label: string;
  meta: string;
  current?: boolean;
}

export interface LandingViewProps {
  landing: SeoRegionLanding;
  asset: MapAssetSlug;
  /** Latest public listings of the region (non-아파트 pages link to them). */
  listings: readonly ListingSummary[];
  /** Same 지역, other 매물 종류 with an indexable page. */
  otherAssets: readonly LandingLink[];
  /** Other 지역 with the same 매물 종류. */
  otherRegions: readonly LandingLink[];
  mapHref: string;
}

function dealRange(d: SeoDealSummary): string {
  if (d.dealType === DealType.MONTHLY && d.minRent !== null && d.maxRent !== null) {
    const deposit = formatPriceRange(d.minPrice, d.maxPrice);
    const rent = d.minRent === d.maxRent ? `${d.minRent}` : `${d.minRent}~${d.maxRent}`;
    return deposit ? `보증금 ${deposit} · 월 ${rent}` : `월 ${rent}`;
  }
  return formatPriceRange(d.minPrice, d.maxPrice) || '가격 협의';
}

/** /suncheon/<지역>/<매물 종류> — factual landing page for "순천 <지역> <매물> 시세" searches. */
export function LandingView({
  landing,
  asset,
  listings,
  otherAssets,
  otherRegions,
  mapHref,
}: LandingViewProps) {
  const cfg = LANDING_ASSETS[asset];
  const { region, trades } = landing;
  const title = landingTitle(region, asset);
  const asOf = formatDateKorean(landing.updatedAt);

  const kpis: Kpi[] = [
    { label: `${cfg.noun} 매물`, value: formatCount(landing.listings.total), unit: '건' },
  ];
  if (cfg.complexes) {
    kpis.push({ label: '단지', value: formatCount(landing.complexTotal), unit: '곳' });
    if (trades) {
      kpis.push({
        label: '매매 실거래 (12개월)',
        value: formatCount(trades.sale.count),
        unit: '건',
        detail: `${ymDot(trades.fromYm)}~${ymDot(trades.toYm)}`,
      });
      if (trades.sale.medianPrice !== null) {
        kpis.push({
          label: '중위 거래가',
          value: formatManwon(trades.sale.medianPrice),
          detail:
            trades.sale.avgPrice !== null ? `평균 ${formatManwon(trades.sale.avgPrice)}` : undefined,
        });
      }
      if (trades.sale.avgPricePerPyeong !== null) {
        kpis.push({
          label: '3.3㎡당 평균 (전용)',
          value: formatPerPyeong(trades.sale.avgPricePerPyeong),
        });
      }
    }
  }

  return (
    <div className={`container ${styles.page}`}>
      <SeoHead
        crumbs={[
          { label: '순천 지역별 시세', href: SEO_ROUTES.regions },
          { label: region.emdName },
          { label: cfg.noun },
        ]}
        eyebrow={placeFull(region)}
        title={title}
        lead={landingIntro(landing, asset)}
        stamp={`${asOf} 기준 · 매물: 중개사 회원 등록 · 실거래: 국토교통부`}
        actions={
          <Button href={mapHref} linkAs={Link} iconLeft={<Icon name="map-pin" size={18} />}>
            지도에서 {cfg.noun} 매물 보기
          </Button>
        }
      />

      <KpiRow items={kpis} label={`${region.emdName} ${cfg.noun} 요약`} />

      <Section
        id="listings"
        title="거래 유형별 매물"
        count={formatCount(landing.listings.total)}
        sub="가격은 만 원 단위 중개사 제시 호가예요. 월세는 보증금과 월 차임을 따로 보여 드려요."
      >
        {landing.listings.byDealType.length === 0 ? (
          <p className={styles.prose}>
            지금은 등록된 {cfg.noun} 매물이 없어요.{' '}
            <Link className="link" href={ROUTES.dealFind}>
              구하기 요청
            </Link>
            을 남기면 이 지역 중개사무소가 맞는 매물을 제안해 드려요.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.narrowTable}`}>
              <caption>{`${region.emdName} ${cfg.noun} 거래 유형별 매물 수와 호가`}</caption>
              <thead>
                <tr>
                  <th scope="col">거래 유형</th>
                  <th scope="col" className={styles.r}>
                    매물
                  </th>
                  <th scope="col">호가 범위</th>
                </tr>
              </thead>
              <tbody>
                {landing.listings.byDealType.map((d) => (
                  <tr key={d.dealType}>
                    <th scope="row">
                      <b className={`t-${dealKindOf(d.dealType)}`}>
                        {DEAL_TYPE_LABEL[d.dealType]}
                      </b>
                    </th>
                    <td className={styles.r}>
                      <b>{formatCount(d.count)}</b>건
                    </td>
                    <td>{dealRange(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {cfg.complexes && landing.complexes.length > 0 && (
        <Section
          id="complexes"
          title={`${region.name} 아파트 단지`}
          count={formatCount(landing.complexTotal)}
          sub="매물이 많은 순서예요. 단지 이름을 누르면 평형별 실거래가와 매물을 볼 수 있어요."
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{`${region.emdName} 아파트 단지 목록`}</caption>
              <thead>
                <tr>
                  <th scope="col">단지</th>
                  <th scope="col" className={styles.r}>
                    세대수
                  </th>
                  <th scope="col">준공</th>
                  <th scope="col" className={styles.r}>
                    매물
                  </th>
                  <th scope="col">최근 매매 실거래</th>
                </tr>
              </thead>
              <tbody>
                {landing.complexes.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      <Link href={ROUTES.complex(c.id)}>{c.name}</Link>
                    </th>
                    <td className={styles.r}>
                      {c.households !== null ? `${formatCount(c.households)}세대` : '—'}
                    </td>
                    <td>
                      {c.approvalDate
                        ? c.approvalDate.slice(0, 7).replace('-', '.')
                        : c.builtYear !== null
                          ? formatBuiltYear(c.builtYear)
                          : '—'}
                    </td>
                    <td className={styles.r}>{formatCount(c.activeListingCount)}건</td>
                    <td>
                      {c.latestSale ? (
                        <>
                          <b>{formatManwon(c.latestSale.price)}</b>
                          <small>
                            {c.latestSale.dealDate.replace(/-/g, '.')} · {tradeSpec(c.latestSale)}
                          </small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {cfg.complexes && trades && trades.recent.length > 0 && (
        <Section
          id="trades"
          title="최근 아파트 매매 실거래"
          sub={`국토교통부 실거래가 · 계약일 기준 최근 ${trades.recent.length}건 (해제 거래 제외)`}
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{`${region.emdName} 최근 아파트 매매 실거래`}</caption>
              <thead>
                <tr>
                  <th scope="col">계약일</th>
                  <th scope="col">단지</th>
                  <th scope="col">전용면적 · 층</th>
                  <th scope="col" className={styles.r}>
                    거래가
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.recent.map((t, i) => (
                  <tr key={`${t.dealDate}-${t.aptName}-${i}`}>
                    <td>{t.dealDate.replace(/-/g, '.')}</td>
                    <th scope="row">
                      {t.complexId ? (
                        <Link href={ROUTES.complex(t.complexId)}>{t.aptName}</Link>
                      ) : (
                        t.aptName
                      )}
                    </th>
                    <td>{tradeSpec(t)}</td>
                    <td className={styles.r}>
                      <b>{formatManwon(t.price)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {listings.length > 0 && (
        <Section
          id="recent-listings"
          title={`최근 등록된 ${cfg.noun} 매물`}
          action={
            <Link className="link t-sm" href={mapHref}>
              전체 매물 지도에서 보기
            </Link>
          }
        >
          <ul className={styles.links}>
            {listings.map((l) => (
              <li key={l.id}>
                <Link className={styles.linkCard} href={ROUTES.listing(l.id)}>
                  <b>{listingDisplayName(l)}</b>
                  <span>
                    {[
                      formatDealPriceLabeled({
                        dealType: l.dealType,
                        price: l.salePrice ?? l.presalePrice ?? l.deposit,
                        deposit: l.deposit,
                        monthlyRent: l.monthlyRent,
                      }),
                      l.exclusiveArea ? `전용 ${formatSqm(l.exclusiveArea)}` : null,
                      l.landArea && !l.exclusiveArea ? `대지 ${formatSqm(l.landArea)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(otherAssets.length > 0 || otherRegions.length > 0) && (
        <Section id="more" title="함께 찾아보는 시세">
          {otherAssets.length > 0 && (
            <nav aria-label={`${region.emdName} 다른 매물 종류`} className={styles.chips}>
              {otherAssets.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={l.current ? `${styles.chip} ${styles.chipCurrent}` : styles.chip}
                  aria-current={l.current ? 'page' : undefined}
                >
                  {l.label} · {l.meta}
                </Link>
              ))}
            </nav>
          )}
          {otherRegions.length > 0 && (
            <ul className={styles.links} aria-label={`다른 지역 ${cfg.noun} 시세`}>
              {otherRegions.map((l) => (
                <li key={l.href}>
                  <Link className={styles.linkCard} href={l.href}>
                    <b>{l.label}</b>
                    <span>{l.meta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <SourceNote>
        <p>
          <b>출처</b> 매물: {DATA_SOURCES.listings.note} 실거래가: {DATA_SOURCES.trades.name} (
          {DATA_SOURCES.trades.provider}), {DATA_SOURCES.trades.updateCadence}.
        </p>
        <p>{DATA_SOURCES.trades.reportingNote}</p>
        <p>
          <Link href={SEO_ROUTES.report}>순천 아파트 실거래 월간 리포트</Link> ·{' '}
          <Link href={SEO_ROUTES.about}>데이터 출처와 서비스 소개</Link>
        </p>
      </SourceNote>
    </div>
  );
}
