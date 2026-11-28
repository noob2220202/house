import {
  AgencyLogo,
  Avatar,
  Breadcrumb,
  Button,
  Chip,
  CtaBar,
  Icon,
  Skeleton,
  cx,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { ROUTES } from '@/config/nav';
import { buildMapHref } from '@/lib/map/url-state';
import type { AgencyDetail, AgencyListingPage } from '../api/schemas';
import {
  SPECIALTY_LABEL,
  agencyTagline,
  directionsUrl,
  displayPhone,
  formatResponseTime,
  fullAddress,
  telHref,
} from '../lib/agency';
import { kstWeekdayKey, openStateAt, weeklyRows } from '../lib/hours';
import { AgencyInquiryButton } from './AgencyInquiryButton';
import { AgencyListingCard } from './AgencyListingCard';
import { AgencyListings } from './AgencyListings';
import { AgencyLocationMap } from './AgencyLocationMap';
import { DealCountBar } from './DealCountBar';
import { OfficeCoverArt } from './OfficeCoverArt';
import { OpenStatus } from './OpenStatus';
import { ProfileActions } from './ProfileActions';
import styles from './AgencyPage.module.css';
import { formatCount } from '@/lib/format';

export interface AgencyPageViewProps {
  agency: AgencyDetail;
  /** Server-rendered listings for `initialListingsKey`. */
  initialListings: AgencyListingPage | null;
  initialListingsKey: string;
}

/** "https://sindae.suncheonmap.kr" → "sindae.suncheonmap.kr" (what the visitor types). */
function siteHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Public page of one 중개사무소 (/agency/[id]). Server component; interactive parts are islands. */
export function AgencyPageView({
  agency,
  initialListings,
  initialListingsKey,
}: AgencyPageViewProps) {
  const tagline = agencyTagline(agency);
  const tel = telHref(agency.phone);
  const phone = displayPhone(agency.phone);
  const address = fullAddress(agency);
  // Only what the 문의 dialog needs crosses into the client island.
  const inquiryAgency = {
    id: agency.id,
    name: agency.name,
    phone: agency.phone,
    logoUrl: agency.logoUrl,
    representativeName: agency.representativeName,
    registrationNumber: agency.registrationNumber,
    roadAddress: agency.roadAddress,
    addressDetail: agency.addressDetail,
  };
  const total = agency.activeListingCount;
  const rows = weeklyRows(agency.businessHours);
  const now = new Date();
  const today = kstWeekdayKey(now);
  const stats = agency.stats;
  const mapHref = buildMapHref(ROUTES.agencies, {
    view: { center: { lat: agency.lat, lng: agency.lng }, zoom: 15 },
    selected: agency.id,
  });

  return (
    <div className={cx('container', styles.wrap)}>
      <Breadcrumb
        className={styles.crumb}
        linkAs={Link}
        items={[
          { label: '홈', href: ROUTES.home },
          { label: '중개사무소', href: ROUTES.agencies },
          { label: agency.name },
        ]}
      />

      <header className={styles.hero}>
        <div className={styles.cover}>
          {agency.coverUrl ? (
            <Image
              src={agency.coverUrl}
              alt={`${agency.name} 전경`}
              fill
              priority
              sizes="(max-width: 720px) 100vw, 1240px"
            />
          ) : (
            <OfficeCoverArt />
          )}
        </div>
        <div className={styles.heroBody}>
          <div className={styles.identity}>
            <AgencyLogo
              className={styles.av}
              name={agency.name}
              seed={agency.id}
              size={88}
              fallback="initials"
              image={
                agency.logoUrl ? <Image src={agency.logoUrl} alt="" fill sizes="88px" /> : undefined
              }
            />
            {tagline && (
              <span className={styles.tag}>
                <Icon name="star" size={14} />
                {tagline}
              </span>
            )}
            <h1 className={styles.name}>{agency.name}</h1>
            <p className={styles.ceo}>
              <span>
                대표 공인중개사 <b>{agency.representativeName}</b>
              </span>
              <span className={styles.verified}>
                <Icon name="shield" size={14} />
                등록 확인
              </span>
              <OpenStatus
                hours={agency.businessHours}
                initial={openStateAt(agency.businessHours, now)}
              />
            </p>
          </div>
          <div className={styles.heroActs}>
            <ProfileActions
              agencyId={agency.id}
              agencyName={agency.name}
              siteUrl={agency.site?.url}
            />
          </div>
          <dl className={styles.kpis}>
            <div className={styles.kpi}>
              <dt>
                <span>보유 매물</span>
              </dt>
              <dd>
                <b>{formatCount(total)}건</b>
              </dd>
            </div>
            {stats?.deals30d != null && (
              <div className={styles.kpi}>
                <dt>
                  <span>최근 30일 거래</span>
                </dt>
                <dd>
                  <b>{formatCount(stats.deals30d)}건</b>
                </dd>
              </div>
            )}
            {stats?.avgResponseMinutes != null && (
              <div className={styles.kpi}>
                <dt>
                  <span>평균 응답</span>
                </dt>
                <dd>
                  <b>{formatResponseTime(stats.avgResponseMinutes)}</b>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <div className={styles.grid}>
        <aside className={styles.aside} aria-label="연락처와 사무소 정보">
          <section className={cx(styles.card, styles.contact)} aria-label="연락처">
            <div>
              <p className={styles.phoneLabel}>대표번호</p>
              <p className={styles.phone}>{phone}</p>
            </div>
            <div className={styles.contactBtns}>
              <AgencyInquiryButton agency={inquiryAgency} />
              {tel && (
                <Button href={tel} iconLeft={<Icon name="phone" size={18} />}>
                  전화하기
                </Button>
              )}
            </div>
            <p className={styles.note}>
              문의하기로 남긴 글은 이 사무소에만 전달돼요. 로그인하고 문의하면 답변을 MY &gt; 문의
              내역에서 볼 수 있어요.
            </p>
          </section>

          <section className={styles.card} aria-labelledby="agency-info">
            <h2 className={styles.cardTitle} id="agency-info">
              사무소 정보
            </h2>
            <dl className={styles.info}>
              <div>
                <dt>
                  <Icon name="clock" size={16} />
                  영업시간
                </dt>
                <dd>
                  {rows.length > 0 ? (
                    <>
                      <div className={styles.hoursHead}>
                        <OpenStatus
                          hours={agency.businessHours}
                          initial={openStateAt(agency.businessHours, now)}
                          withHint
                        />
                      </div>
                      <dl className={styles.hours}>
                        {rows.map((r) => (
                          <div key={r.key} style={{ display: 'contents' }}>
                            <dt>
                              {r.label}
                              {r.key === today && <span className="sr-only"> (오늘)</span>}
                            </dt>
                            <dd className={r.closed ? styles.closed : undefined}>
                              {r.key === today ? <b>{r.text}</b> : r.text}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : (
                    <span className={styles.muted}>
                      등록된 영업시간이 없어요. 전화로 확인해 주세요.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="map-pin" size={16} />
                  주소
                </dt>
                <dd>
                  {address}
                  <a
                    className="link"
                    href={directionsUrl(agency)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${agency.name} 길찾기 (새 창)`}
                  >
                    길찾기
                  </a>
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="phone" size={16} />
                  대표번호
                </dt>
                <dd className="num">{tel ? <a href={tel}>{phone}</a> : phone}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="shield" size={16} />
                  등록번호
                </dt>
                <dd className="num">{agency.registrationNumber}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="user" size={16} />
                  대표
                </dt>
                <dd>{agency.representativeName} (개업공인중개사)</dd>
              </div>
              {agency.site && (
                <div>
                  <dt>
                    <Icon name="home" size={16} />
                    홈페이지
                  </dt>
                  <dd>
                    <a
                      className="link"
                      href={agency.site.url}
                      target="_blank"
                      rel="noopener"
                      aria-label={`${agency.name} 홈페이지 ${siteHost(agency.site.url)} (새 창)`}
                    >
                      {siteHost(agency.site.url)}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>

        <div className={styles.main}>
          {(agency.intro || agency.specialties.length > 0 || agency.topComplexes.length > 0) && (
            <section className={styles.sec} aria-labelledby="agency-intro">
              <div className={styles.secHd}>
                <h2 id="agency-intro">사무소 소개</h2>
              </div>
              {agency.intro && <p className={styles.intro}>{agency.intro}</p>}
              {agency.specialties.length > 0 && (
                <>
                  <p className={styles.chipLabel}>전문 분야</p>
                  <ul className={styles.chipRow}>
                    {agency.specialties.map((s) => (
                      <li key={s}>
                        <Chip>{SPECIALTY_LABEL[s]}</Chip>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {agency.topComplexes.length > 0 && (
                <>
                  <p className={styles.chipLabel}>전문 단지</p>
                  <ul className={styles.chipRow}>
                    {agency.topComplexes.map((c) => (
                      <li key={c.id}>
                        <Chip
                          href={ROUTES.complex(c.id)}
                          linkAs={Link}
                          iconLeft={<Icon name="building" size={16} />}
                        >
                          {c.name}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {agency.featuredListings.length > 0 && (
            <section className={styles.sec} aria-labelledby="agency-featured">
              <div className={styles.secHd}>
                <h2 id="agency-featured">대표 매물</h2>
                <p>사무소가 직접 고른 매물이에요</p>
              </div>
              <ul className={styles.featured}>
                {agency.featuredListings.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <AgencyListingCard listing={l} sizes="(max-width: 720px) 72vw, 260px" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.sec} id="listings" aria-labelledby="agency-listings-title">
            <div className={styles.secHd}>
              <h2 id="agency-listings-title">
                보유 매물 <span className="num">{formatCount(total)}</span>건
              </h2>
              <p>여러 중개사무소가 함께 올린 매물도 1건으로 세요</p>
            </div>
            <DealCountBar counts={agency.listingCounts} size="lg" />
            <Suspense fallback={<Skeleton width="100%" height={320} radius={16} />}>
              <AgencyListings
                agencyId={agency.id}
                agencyName={agency.name}
                total={total}
                countsByAsset={agency.listingCountsByAsset}
                initialPage={initialListings}
                initialKey={initialListingsKey}
              />
            </Suspense>
          </section>

          <section className={styles.sec} aria-labelledby="agency-location">
            <div className={styles.secHd}>
              <h2 id="agency-location">위치</h2>
            </div>
            <div className={styles.mapBox}>
              <AgencyLocationMap
                id={agency.id}
                name={agency.name}
                lat={agency.lat}
                lng={agency.lng}
                listingCount={total}
              />
            </div>
            <div className={styles.mapAddr}>
              <p>
                <Icon name="map-pin" size={18} />
                {address}
              </p>
              <div className={styles.mapLinks}>
                <Button
                  size="sm"
                  variant="secondary"
                  href={directionsUrl(agency)}
                  target="_blank"
                  rel="noopener noreferrer"
                  iconRight={<Icon name="external-link" size={16} />}
                >
                  길찾기
                </Button>
                <Button size="sm" variant="soft" href={mapHref} linkAs={Link}>
                  주변 중개사무소 보기
                </Button>
              </div>
            </div>
          </section>

          {agency.members.length > 0 && (
            <section className={styles.sec} aria-labelledby="agency-members">
              <div className={styles.secHd}>
                <h2 id="agency-members">소속 중개사</h2>
                <p>공인중개사 자격 여부를 함께 표시해요</p>
              </div>
              <ul className={styles.members}>
                {agency.members.map((m) => (
                  <li key={`${m.displayName}-${m.title ?? ''}`} className={styles.member}>
                    <Avatar
                      name={m.displayName}
                      size={44}
                      tone={m.isLicensed ? 'ink' : 'neutral'}
                    />
                    <span>
                      <b>{m.displayName}</b>
                      <span>
                        {m.title ??
                          (m.role === 'OWNER'
                            ? '대표'
                            : m.isLicensed
                              ? '소속공인중개사'
                              : '중개보조원')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className={styles.ctaWrap}>
        <CtaBar>
          <AgencyInquiryButton agency={inquiryAgency} />
          {tel && (
            <Button
              href={tel}
              iconLeft={<Icon name="phone" size={18} />}
              aria-label={`${agency.name}에 전화 ${phone}`}
            >
              <span className="num">{phone}</span>
            </Button>
          )}
        </CtaBar>
      </div>
    </div>
  );
}
