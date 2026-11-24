import { ASSET_TYPE_LABEL, DEAL_TYPE_LABEL, DealType } from '@house/shared';
import {
  AgencyLogo,
  Badge,
  Breadcrumb,
  Button,
  DealBadge,
  EmptyState,
  Icon,
  PhotoPlaceholder,
  dealKindOf,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import {
  formatCount,
  formatManwon,
  formatPerPyeong,
  formatPhone,
  formatPriceShort,
} from '@/lib/format';
import type {
  Banner,
  ComplexAgency,
  ComplexDetail,
  ComplexListings,
  ComplexStats,
  NearbyComplex,
  TradePage,
} from '../api/schemas';
import { completionLabel, complexOverview, dealRangeText, formatDistance } from '../lib/complex';
import { complexMapHref } from '../lib/links';
import { areaTypeLabel } from '../lib/listing';
import { dealMonthLabel, defaultAreaType, latestByAreaType, tradeAmount } from '../lib/trend';
import { FeaturedAgencyCard } from '../panel/FeaturedAgencyCard';
import { AreaTypeSection } from './AreaTypeSection';
import { ComplexActions } from './ComplexActions';
import { ListingPreview } from './ListingPreview';
import { LocationMap } from './LocationMap';
import { TradeSection } from './TradeSection';
import styles from './page.module.css';

export interface ComplexPageData {
  complex: ComplexDetail;
  /** Stats of the default series (매매 · most common 평형) incl. the latest trade per 평형. */
  stats: ComplexStats | null;
  trades: TradePage | null;
  /** First listings + per-deal summary. */
  listings: ComplexListings | null;
  nearby: NearbyComplex[];
  agencies: ComplexAgency[];
  /** Live COMPLEX_FEATURED_AGENCY banners (undefined = not fetched → the card loads them itself). */
  featured?: Banner[];
}

const DEAL_ORDER: DealType[] = [DealType.PRESALE, DealType.SALE, DealType.JEONSE, DealType.MONTHLY];

/** /complex/[id] — server-rendered 단지 page (SEO): 개요, 평형, 실거래가, 매물, 위치, 주변 단지. */
export function ComplexPageView({ data }: { data: ComplexPageData }) {
  const { complex, stats, trades, listings, nearby, agencies, featured } = data;
  const summary = listings?.summary;
  const deals = DEAL_ORDER.flatMap((t) => {
    const d = summary?.byDealType.find((x) => x.dealType === t);
    return d && d.count > 0 ? [d] : [];
  });
  const headline =
    deals.find((d) => d.dealType === DealType.SALE) ??
    deals.find((d) => d.dealType === DealType.PRESALE) ??
    deals[0];
  const total = summary?.total ?? complex.activeListingCount;
  const mainArea = defaultAreaType(complex.areaTypes);
  const mainTrade = mainArea
    ? latestByAreaType([mainArea], stats?.latest ?? [], 'SALE')[0]?.trade
    : null;
  const mainTradeAmount = mainTrade ? tradeAmount(mainTrade) : null;
  const overview = complexOverview(complex);
  const photo = complex.photos[0];
  const done = completionLabel(complex);
  const mapHref = complexMapHref(complex);
  const address = complex.roadAddress ?? complex.jibunAddress;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.top}>
        <Breadcrumb
          linkAs={Link}
          items={[
            { label: '홈', href: ROUTES.home },
            { label: '아파트·분양권', href: ROUTES.map('apt') },
            ...(complex.emdName ? [{ label: complex.emdName }] : []),
            { label: complex.name },
          ]}
        />
        <p className={styles.topMeta}>
          관심 <b>{formatCount(complex.favoriteCount)}</b>
          <span aria-hidden="true">·</span>
          조회 <b>{formatCount(complex.viewCount)}</b>
        </p>
      </div>

      <div className={photo ? styles.hero : `${styles.hero} ${styles.heroEmpty}`}>
        {photo ? (
          <Image
            src={photo.url}
            alt={photo.caption ?? `${complex.name} 전경`}
            fill
            priority
            sizes="(max-width: 720px) 100vw, 1240px"
          />
        ) : (
          <PhotoPlaceholder kind="tower" label={`${complex.name} 단지 이미지 준비 중`} />
        )}
        <span className={styles.heroCap}>
          {photo
            ? complex.photos.length > 1
              ? `단지 사진 ${complex.photos.length}장`
              : (photo.caption ?? '단지 전경')
            : '단지 사진 준비 중'}
        </span>
      </div>

      <div className={styles.body}>
        <header className={styles.head}>
          <div className={styles.badges}>
            <Badge tone="brand">{ASSET_TYPE_LABEL[complex.assetType]}</Badge>
            {complex.districtName && <Badge>{complex.districtName}</Badge>}
            {complex.approvalDate === null && done?.endsWith('예정') && (
              <Badge tone="accent">{done}</Badge>
            )}
          </div>
          <h1 className={`t-h1 ${styles.name}`}>{complex.name}</h1>
          <p className={styles.addr}>
            {address && (
              <span className={styles.addrT}>
                <Icon name="map-pin" size={18} />
                {address}
              </span>
            )}
            {complex.households !== null && <span>{formatCount(complex.households)}세대</span>}
            {done && !done.endsWith('예정') && <span>{done}</span>}
          </p>
          <div className={styles.price}>
            <div className={styles.priceMain}>
              {headline ? (
                <>
                  <span className={`${styles.priceK} t-${dealKindOf(headline.dealType)}`}>
                    {DEAL_TYPE_LABEL[headline.dealType]} 호가
                  </span>
                  <b className={`price ${styles.priceV}`}>{dealRangeText(headline)}</b>
                </>
              ) : (
                <>
                  <span className={styles.priceK}>매물</span>
                  <b className={`price ${styles.priceV}`}>등록된 매물 없음</b>
                </>
              )}
            </div>
            <dl className={styles.priceCtx}>
              {complex.avgPricePerPyeong !== null && (
                <div>
                  <dt>평당가</dt>
                  <dd>{formatPerPyeong(complex.avgPricePerPyeong)}</dd>
                </div>
              )}
              {mainArea && mainTrade && mainTradeAmount !== null && (
                <div>
                  <dt>최근 실거래 · {areaTypeLabel(mainArea)}</dt>
                  <dd>
                    {formatManwon(mainTradeAmount)}
                    <small className={styles.sub}>{dealMonthLabel(mainTrade.dealDate)}</small>
                  </dd>
                </div>
              )}
              <div>
                <dt>매물</dt>
                <dd>
                  {formatCount(total)}
                  <small>건</small>
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <aside className={styles.side} aria-label="매물 요약">
          <section className={styles.scard}>
            <div className={styles.scardHd}>
              <h2 className={styles.scardT}>
                이 단지 매물 <span>{formatCount(total)}</span>
              </h2>
              <p className={styles.scardS}>
                여러 중개사무소가 함께 올려도 같은 매물은 1건으로 세요.
              </p>
            </div>
            {deals.length > 0 && (
              <ul className={styles.sdeals}>
                {deals.map((d) => (
                  <li key={d.dealType} className={styles.sdeal}>
                    <DealBadge deal={dealKindOf(d.dealType)} />
                    <b>{dealRangeText(d)}</b>
                    <span>{formatCount(d.count)}건</span>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.scardAct}>
              <Button
                href={mapHref}
                linkAs={Link}
                block
                iconLeft={<Icon name="map-pin" size={18} />}
              >
                {total > 0 ? `매물 ${formatCount(total)}건 지도에서 보기` : '지도에서 보기'}
              </Button>
              <ComplexActions complexId={complex.id} name={complex.name} />
            </div>
          </section>

          <FeaturedAgencyCard
            complexId={complex.id}
            initialBanners={featured}
            initialAgencies={agencies}
            className={styles.sideAd}
          />

          {agencies.length > 0 && (
            <section className={styles.scard}>
              <div className={styles.scardHd}>
                <h2 className={styles.scardT}>
                  이 단지 중개사무소 <span>{formatCount(agencies.length)}</span>
                </h2>
                <p className={styles.scardS}>
                  이 단지 매물을 올린 사무소예요. 매물이 많은 순서로 보여요.
                </p>
              </div>
              <ul className={styles.offices}>
                {agencies.slice(0, 4).map((a) => (
                  <li key={a.agencyId} className={styles.office}>
                    <AgencyLogo
                      name={a.name}
                      seed={a.agencyId}
                      size={44}
                      image={
                        a.logoUrl ? <Image src={a.logoUrl} alt="" fill sizes="44px" /> : undefined
                      }
                    />
                    <span className={styles.officeT}>
                      <Link href={ROUTES.agency(a.agencyId)}>{a.name}</Link>
                      <span>
                        {[
                          a.representativeName ? `대표 ${a.representativeName}` : '',
                          `이 단지 매물 ${formatCount(a.complexListingCount)}건`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {a.phone && (
                      <Button
                        variant="soft"
                        size="sm"
                        href={`tel:${a.phone}`}
                        iconLeft={<Icon name="phone" size={16} />}
                        aria-label={`${a.name}에 전화 (${formatPhone(a.phone)})`}
                      >
                        전화
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div className={styles.main}>
          <nav className={styles.anchors} aria-label="단지 정보 바로가기">
            <a href="#overview">단지 개요</a>
            <a href="#area-types">평형 정보</a>
            <a href="#trades">실거래가</a>
            <a href="#listings">매물</a>
            <a href="#location">위치</a>
            {nearby.length > 0 && <a href="#nearby">주변 단지</a>}
          </nav>

          <section className={styles.sec} id="overview" aria-labelledby="overview-title">
            <div className={styles.secHd}>
              <h2 className={styles.secT} id="overview-title">
                단지 개요
              </h2>
            </div>
            <dl className={styles.facts}>
              {overview.map((f) => (
                <div key={f.label} className={styles.fact}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              {/* Fill the last grid row so no grey gap shows. */}
              {Array.from({ length: (12 - (overview.length % 12)) % 12 }, (_, i) => (
                <div key={`fill-${i}`} className={styles.factFill} aria-hidden="true" />
              ))}
            </dl>
          </section>

          {complex.areaTypes.length > 0 && (
            <AreaTypeSection areaTypes={complex.areaTypes} latest={stats?.latest ?? []} />
          )}

          <TradeSection
            complexId={complex.id}
            complexName={complex.name}
            areaTypes={complex.areaTypes}
            initialStats={stats}
            initialTrades={trades}
          />

          <section className={styles.sec} id="listings" aria-labelledby="listings-title">
            <div className={styles.secHd}>
              <h2 className={styles.secT} id="listings-title">
                매물<span className={styles.secN}>{formatCount(total)}</span>
              </h2>
              {total > 0 && (
                <Link className="link t-sm" href={mapHref}>
                  전체 매물 보기
                </Link>
              )}
            </div>
            {deals.length === 0 || !listings || listings.items.length === 0 ? (
              <EmptyState
                compact
                icon="building"
                title="등록된 매물이 아직 없어요"
                description="구하기 요청을 남기면 이 지역 중개사무소가 맞는 매물을 제안해 드려요."
                action={
                  <Button variant="secondary" size="sm" href={ROUTES.dealFind} linkAs={Link}>
                    구하기 요청 남기기
                  </Button>
                }
              />
            ) : (
              <>
                <div className={styles.deals}>
                  {deals.map((d) => (
                    <Link
                      key={d.dealType}
                      className={styles.deal}
                      href={complexMapHref(complex, d.dealType)}
                    >
                      <span className={styles.dealK}>
                        <DealBadge deal={dealKindOf(d.dealType)} />
                        <span>
                          <b>{formatCount(d.count)}</b>건
                        </span>
                      </span>
                      <b className={styles.dealV}>{dealRangeText(d)}</b>
                    </Link>
                  ))}
                </div>
                <div className={styles.listCard}>
                  <ListingPreview listings={listings.items} />
                  {total > listings.items.length && (
                    <div className={styles.listFoot}>
                      <Button variant="secondary" href={mapHref} linkAs={Link}>
                        매물 {formatCount(total)}건 모두 보기
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <section className={styles.sec} id="location" aria-labelledby="location-title">
            <div className={styles.secHd}>
              <h2 className={styles.secT} id="location-title">
                위치
              </h2>
            </div>
            <div className={styles.minimap}>
              <LocationMap complex={complex} nearby={nearby} />
            </div>
            <div className={styles.locRow}>
              <p className={styles.locAddr}>
                {complex.roadAddress ?? complex.jibunAddress ?? '주소 정보 준비 중'}
                {complex.roadAddress && complex.jibunAddress && (
                  <span>지번 {complex.jibunAddress}</span>
                )}
              </p>
              <Button variant="secondary" size="sm" href={mapHref} linkAs={Link}>
                지도에서 크게 보기
              </Button>
            </div>
          </section>

          {nearby.length > 0 && (
            <section className={styles.sec} id="nearby" aria-labelledby="nearby-title">
              <div className={styles.secHd}>
                <h2 className={styles.secT} id="nearby-title">
                  주변 단지<span className={styles.secN}>{nearby.length}</span>
                </h2>
                <span className={styles.secSub}>가까운 순 · 직선 거리</span>
              </div>
              <ul className={styles.nearGrid}>
                {nearby.map((n) => (
                  <li key={n.id}>
                    <Link className={styles.nearItem} href={ROUTES.complex(n.id)}>
                      <span className={styles.nearPh}>
                        <PhotoPlaceholder kind="tower" />
                      </span>
                      <span className={styles.nearT}>
                        <span className={styles.nearName}>{n.name}</span>
                        <span className={styles.nearMeta}>
                          {[
                            formatDistance(n.distanceM),
                            n.households !== null ? `${formatCount(n.households)}세대` : '',
                            n.builtYear !== null ? `${n.builtYear}년` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className={styles.nearR}>
                        {n.representative?.price !== null &&
                          n.representative?.price !== undefined && (
                            <span className={styles.nearP}>
                              <small>
                                {n.representative.dealType === DealType.PRESALE ? '분양권 ' : ''}
                                {n.representative.pyeongLabel}
                              </small>
                              {formatPriceShort(n.representative.price)}
                            </span>
                          )}
                        <span className={styles.nearC}>
                          매물 {formatCount(n.activeListingCount)}건
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
