import {
  ASSET_TYPE_LABEL,
  AssetType,
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  DealType,
  InquirySource,
  LISTING_OPTION_LABEL,
  LISTING_STATUS_LABEL,
  ListingStatus,
  VerificationMethod,
} from '@house/shared';
import {
  AdFrame,
  Badge,
  Breadcrumb,
  Button,
  DealBadge,
  Icon,
  cx,
  photoKindForAsset,
} from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import { BannerPicture, bannerClickHref } from '@/lib/ads';
import {
  formatCount,
  formatDateShort,
  formatMaintenanceFee,
  formatManwon,
  formatSqm,
  sqmToPyeong,
} from '@/lib/format';
import type { ListingDetail, ServedBanner, SimilarListings } from '../api/schemas';
import { calcPreviews } from '../lib/calcPreview';
import type { ListingOfficeVariant } from '../lib/office';
import {
  addressLine,
  areaLabel,
  buildBreadcrumb,
  descriptionParagraphs,
  floorText,
  headlineAmount,
  headlinePrice,
  listingFullTitle,
  listingName,
  listingNo,
  listingSubtitle,
  mapHref,
  moveInText,
  priceLabel,
  pricePerPyeong,
  statusNotice,
} from '../lib/view';
import { BackToMapLink } from './BackToMapLink';
import { BrokersCard } from './BrokersCard';
import { DescriptionSection } from './DescriptionSection';
import { FactsSection } from './FactsSection';
import { Gallery } from './Gallery';
import { Glyph, OPTION_META } from './icons';
import { ListingInteractions } from './ListingInteractions';
import { LocationSection } from './LocationSection';
import styles from './page.module.css';
import { PriceSection } from './PriceSection';
import {
  ActionsBar,
  AdImpression,
  CalcCard,
  MobileCta,
  MobileFoot,
  RecentViewTracker,
} from './SideActions';
import side from './side.module.css';
import { SimilarSection } from './SimilarSection';

export interface ListingPageProps {
  listing: ListingDetail;
  similar: SimilarListings;
  /** First live banner of the LISTING_SIDE slot, if any. */
  ad: ServedBanner | null;
  /** Render time (ms) of the server page, shared with the client islands that print dates. */
  renderedAt: number;
  /**
   * Rendered on an office's own 홈페이지: pass `listing.agencies` narrowed to that office, no ad and
   * no similar listings (`officeMore` takes their place).
   */
  office?: ListingOfficeVariant | null;
  /** Office variant: "이 사무소의 다른 매물" below the page body. */
  officeMore?: ReactNode;
}

interface CtxItem {
  label: string;
  /** Extra label text shown on wide screens only (" · 34평"). */
  labelMore?: string;
  value: string;
  small?: string;
  /** `small` is a second figure ("154.9평"), not a unit suffix ("/평") — keep a gap on mobile too. */
  smallApart?: boolean;
  note?: string;
}

/** The three context figures beside the price (평당가 · 단지 평균 · 최근 실거래, or 관리비 · 면적 · 입주). */
function priceContext(l: ListingDetail): CtxItem[] {
  const items: CtxItem[] = [];
  const perPyeong = pricePerPyeong(l);
  if (perPyeong) items.push({ label: '평당가', value: `${formatCount(perPyeong)}만` });
  if (l.complex?.avgPricePerPyeong && perPyeong) {
    items.push({
      label: '단지 평균',
      value: `${formatCount(l.complex.avgPricePerPyeong)}만`,
      small: '/평',
    });
  }
  // A 월세 asking price ("2,000/65") cannot be set against a single-figure 실거래 price.
  const trade = l.dealType === DealType.MONTHLY ? null : l.complex?.latestTrade;
  if (trade) {
    items.push({
      label: '최근 실거래',
      labelMore: trade.pyeongLabel ? ` · ${trade.pyeongLabel}` : undefined,
      value: formatManwon(trade.price),
      small: formatDateShort(trade.dealDate).slice(0, 5),
      note: [formatDateShort(trade.dealDate).slice(0, 5), trade.floor ? `${trade.floor}층` : null]
        .filter(Boolean)
        .join(' · '),
    });
  }
  if (items.length < 3 && l.maintenanceFeeWon !== null && l.maintenanceFeeWon !== undefined) {
    items.push({
      label: '관리비',
      value: l.maintenanceFeeWon === 0 ? '없음' : `월 ${formatMaintenanceFee(l.maintenanceFeeWon)}`,
    });
  }
  const area = l.property.exclusiveArea ?? l.property.landArea;
  if (items.length < 3 && area) {
    items.push({
      label: l.property.exclusiveArea ? '전용면적' : '대지면적',
      value: formatSqm(area),
      small: `${sqmToPyeong(area, 1)}평`,
      smallApart: true,
    });
  }
  if (items.length < 3 && l.moveInType && l.assetType !== AssetType.LAND) {
    items.push({ label: '입주', value: moveInText(l).value });
  }
  return items.slice(0, 3);
}

/** Listing detail page body (server component). Interactive islands receive only what they need. */
export function ListingPage({
  listing,
  similar,
  ad,
  renderedAt,
  office = null,
  officeMore,
}: ListingPageProps) {
  const l = listing;
  const name = listingName(l);
  const subtitle = listingSubtitle(l);
  const price = headlinePrice(l);
  const ctx = priceContext(l);
  const crumbs = office
    ? [
        { label: office.name, href: office.homeHref },
        { label: '매물', href: office.listingsHref },
        { label: [name, DEAL_TYPE_LABEL[l.dealType]].join(' ') },
      ]
    : buildBreadcrumb(l);
  // The map lives on the main site only.
  const bigMap = office ? `${office.mainSiteUrl}${mapHref(l)}` : mapHref(l);
  const primary = l.agencies.find((a) => a.isPrimary) ?? l.agencies[0];
  const siteVisit = l.verifications.find((v) => v.method === VerificationMethod.SITE_VISIT);
  const notice = statusNotice(l);
  const area = areaLabel(l);
  const mobileSub = [
    l.property.dong,
    floorText(l),
    area,
    l.property.direction ? DIRECTION_LABEL[l.property.direction] : null,
  ].filter((v): v is string => !!v);
  const paragraphs = descriptionParagraphs(l.description);
  const titleForAlt = [name, l.property.dong].filter(Boolean).join(' ');

  return (
    <ListingInteractions
      listing={l}
      office={office}
      inquirySource={office ? InquirySource.SITE : InquirySource.MAIN}
    >
      <div className={cx('container', styles.lst)}>
        <div className={styles.top}>
          {office ? (
            <Button
              href={office.listingsHref}
              linkAs={Link}
              variant="ghost"
              size="sm"
              className={styles.back}
              iconLeft={<Icon name="chevron-left" size={18} />}
            >
              매물 목록
            </Button>
          ) : (
            <Button
              href={bigMap}
              linkAs={BackToMapLink}
              variant="ghost"
              size="sm"
              className={styles.back}
              iconLeft={<Icon name="chevron-left" size={18} />}
            >
              지도로 돌아가기
            </Button>
          )}
          <Breadcrumb items={crumbs} linkAs={Link} className={styles.bc} />
          <p className={styles.id}>
            매물번호 <b className="num">{listingNo(l)}</b>
            {l.publishedAt && (
              <>
                <span aria-hidden="true">·</span>등록 {formatDateShort(l.publishedAt)}
              </>
            )}
            <span aria-hidden="true">·</span>조회{' '}
            <span className="num">{formatCount(l.viewCount)}</span>
          </p>
        </div>

        <Gallery
          photos={l.photos}
          title={titleForAlt}
          shotLabel={siteVisit ? `현장 촬영 ${formatDateShort(siteVisit.verifiedAt)}` : null}
          placeholder={photoKindForAsset(l.assetType)}
          backHref={office ? office.homeHref : bigMap}
        />

        <div className={styles.body}>
          <article className={styles.main} aria-labelledby="lst-h1">
            <header className={styles.head}>
              <div className={styles.badges}>
                <DealBadge deal={price.kind} solid>
                  {DEAL_TYPE_LABEL[l.dealType]}
                </DealBadge>
                <Badge>{ASSET_TYPE_LABEL[l.assetType]}</Badge>
                {l.status !== ListingStatus.ACTIVE && (
                  <Badge tone="warn">{LISTING_STATUS_LABEL[l.status]}</Badge>
                )}
                {l.verifiedAt && (
                  <span className={styles.verified}>
                    <Icon name="check-circle" size={14} />
                    실매물 확인 {formatDateShort(l.verifiedAt)}
                  </span>
                )}
                {l.agencies.length > 1 && (
                  <span className={cx(styles.brokers, 'only-lg')}>
                    <Icon name="users" size={14} />
                    중개사 {l.agencies.length}곳 공동중개
                  </span>
                )}
              </div>
              <div className={styles.titleBox}>
                <h1 className={cx('t-h1', styles.title)} id="lst-h1">
                  {name}
                  {subtitle && (
                    <>
                      {' '}
                      <span className={cx(styles.titleSub, 'only-lg')}>{subtitle}</span>
                    </>
                  )}
                </h1>
                {mobileSub.length > 0 && (
                  <p className={cx(styles.mSub, 'only-sm')}>
                    {mobileSub.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </p>
                )}
                <p className={styles.addr}>
                  <span className={styles.addrT}>
                    <Icon name="map-pin" size={16} />
                    <span className="only-lg">{addressLine(l)}</span>
                    <span className="only-sm">{addressLine(l, true)}</span>
                  </span>
                  {l.complex && (
                    <Link
                      className={cx('link', styles.addrLink)}
                      href={ROUTES.complex(l.complex.id)}
                    >
                      단지 정보
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  )}
                </p>
              </div>
              {notice && (
                <p className={styles.notice} role="status">
                  <Icon name="info" size={18} />
                  {notice}
                </p>
              )}
              <div className={styles.price}>
                <div className={styles.priceMain}>
                  <span className={cx(styles.priceK, `t-${price.kind}`)}>{price.label}</span>
                  <p className={cx('price', 'price-xl', styles.priceV)}>
                    {price.text}
                    {price.unit && <span className="unit">{price.unit}</span>}
                  </p>
                  {price.note && <span className={styles.priceNote}>{price.note}</span>}
                </div>
                {ctx.length > 0 && (
                  <dl className={cx(styles.ctx, styles[`ctx${ctx.length}`])}>
                    {ctx.map((c) => (
                      <div key={c.label}>
                        <dt>
                          {c.label}
                          {c.labelMore && <span className="only-lg">{c.labelMore}</span>}
                        </dt>
                        <dd className="num">
                          {c.value}
                          {c.small && (
                            <small
                              className={cx(c.note && 'only-lg', c.smallApart && styles.ctxApart)}
                            >
                              {c.small}
                            </small>
                          )}
                        </dd>
                        {c.note && (
                          <span className={cx(styles.ctxNote, 'num', 'only-sm')}>{c.note}</span>
                        )}
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </header>

            <div className={styles.band} aria-hidden="true" />
            <FactsSection listing={l} renderedAt={renderedAt} />

            <div className={styles.band} aria-hidden="true" />
            <DescriptionSection
              paragraphs={paragraphs}
              highlights={l.highlights}
              byline={
                primary
                  ? `${primary.name} 작성${l.publishedAt ? ` · ${formatDateShort(l.publishedAt)}` : ''}`
                  : null
              }
            />

            {l.options.length > 0 && (
              <section className={styles.sec} aria-labelledby="s-opt">
                <div className={styles.secHd}>
                  <h2 className={styles.secT} id="s-opt">
                    옵션 <span className={cx(styles.secN, 'num')}>{l.options.length}</span>
                  </h2>
                </div>
                <ul className={styles.opts}>
                  {l.options.map((o) => (
                    <li key={o} className={styles.opt}>
                      <span className={styles.optIc}>
                        <Glyph name={OPTION_META[o].glyph} size={22} />
                      </span>
                      <span className={styles.optT}>
                        <b>{LISTING_OPTION_LABEL[o]}</b>
                        <span>{OPTION_META[o].group}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className={cx(styles.band, styles.flowOnly)} aria-hidden="true" />
            <div className={cx(styles.flowOnly, styles.flowBrokers)}>
              <BrokersCard agencies={l.agencies} idPrefix="flow" />
            </div>

            <div className={styles.band} aria-hidden="true" />
            <LocationSection
              center={{ lat: l.property.lat, lng: l.property.lng }}
              address={l.property.roadAddress}
              markerTitle={titleForAlt}
              shortTitle={l.property.dong}
              dealLabel={DEAL_TYPE_LABEL[l.dealType]}
              priceText={price.text}
              nearby={l.nearby}
              mapHref={bigMap}
            />

            {l.complex && (
              <>
                <div className={styles.band} aria-hidden="true" />
                <PriceSection
                  complex={l.complex}
                  areaTypeId={l.property.areaTypeId ?? null}
                  dealType={l.dealType}
                  askingPrice={headlineAmount(l)}
                />
              </>
            )}
          </article>

          <aside className={styles.side} aria-label="중개사무소와 도구">
            <div className={styles.sideIn}>
              <BrokersCard agencies={l.agencies} idPrefix="side" className={styles.asideOnly} />
              <ActionsBar />
              <CalcCard rows={calcPreviews(l)} />
              {!office && ad?.imageUrl && (
                <div className={side.ad}>
                  <AdFrame
                    slot="side"
                    href={ad.linkUrl ? bannerClickHref(ad.id) : undefined}
                    label={ad.advertiserName ?? ad.title}
                    newWindow={ad.newWindow}
                  >
                    <BannerPicture
                      src={ad.imageUrl}
                      mobileSrc={ad.mobileImageUrl}
                      alt={ad.title}
                      sizes="(max-width: 1080px) 100vw, 384px"
                    />
                  </AdFrame>
                  <AdImpression bannerId={ad.id} />
                </div>
              )}
            </div>
          </aside>
        </div>

        {office ? officeMore : <SimilarSection similar={similar} mapHref={bigMap} />}
        <MobileFoot listingNo={listingNo(l)} viewCount={l.viewCount} />
      </div>
      <MobileCta />
      <RecentViewTracker
        entry={{
          id: l.id,
          title: listingFullTitle(l).replace(` ${priceLabel(l)}`, ''),
          priceLabel: priceLabel(l),
          meta: [
            area,
            floorText(l),
            l.property.direction ? DIRECTION_LABEL[l.property.direction] : null,
          ]
            .filter(Boolean)
            .join(' · '),
          thumbUrl: l.photos[0]?.thumbUrl ?? l.photos[0]?.url ?? null,
        }}
      />
    </ListingInteractions>
  );
}
