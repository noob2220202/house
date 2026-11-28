import type { AssetType } from '@house/shared';
import { Avatar, Chip, Icon, Skeleton, cx } from '@house/ui';
import Image from 'next/image';
import { Suspense } from 'react';
import type { AgencyListingPage } from '@/features/w-agencies/api/schemas';
import { AgencyListings } from '@/features/w-agencies/components/AgencyListings';
import { AgencyLocationMap } from '@/features/w-agencies/components/AgencyLocationMap';
import { OfficeCoverArt } from '@/features/w-agencies/components/OfficeCoverArt';
import { OpenStatus } from '@/features/w-agencies/components/OpenStatus';
import {
  SPECIALTY_LABEL,
  directionsUrl,
  displayPhone,
  fullAddress,
  telHref,
} from '@/features/w-agencies/lib/agency';
import { kstWeekdayKey, openStateAt, weeklyRows } from '@/features/w-agencies/lib/hours';
import { formatCount } from '@/lib/format';
import type { OfficeSite } from '../api/schemas';
import { officeContactAgency } from '../lib/site';
import { OfficeContactActions } from './OfficeContactActions';
import { OfficeLogo } from './OfficeSiteShell';
import styles from './OfficeSite.module.css';

export interface OfficeHomeProps {
  site: OfficeSite;
  /** Listings the office registered first, all filters off (hero count); null = unknown. */
  listingTotal: number | null;
  /** The same per 종류 (asset tabs). */
  countsByAsset: Partial<Record<AssetType, number>>;
  /** All counts are primary-only (else the tabs show no numbers). */
  countsExact: boolean;
  /** Server-rendered listing page for `initialListingsKey` (the URL's filters). */
  initialListings: AgencyListingPage | null;
  initialListingsKey: string;
}

/** Title of a member as the public page shows it. */
function memberTitle(m: OfficeSite['agency']['members'][number]): string {
  if (m.title) return m.title;
  if (m.role === 'OWNER') return '대표 공인중개사';
  return m.isLicensed ? '소속공인중개사' : '중개보조원';
}

/**
 * Home of an office's own site: hero (cover, logo, name, 한 줄 소개, 대표, 등록 확인, 보유 매물),
 * 매물 (only the listings the office registered first), 사무소 소개 and 오시는 길. Server component;
 * the listing grid, the map and the contact buttons are islands.
 */
export function OfficeHome({
  site,
  listingTotal,
  countsByAsset,
  countsExact,
  initialListings,
  initialListingsKey,
}: OfficeHomeProps) {
  const a = site.agency;
  const contact = officeContactAgency(site);
  const now = new Date();
  const today = kstWeekdayKey(now);
  const rows = weeklyRows(a.businessHours);
  const address = fullAddress(a);
  const tel = telHref(a.phone);
  const phone = displayPhone(a.phone);
  // Never the office-wide counter (it includes co-brokered listings the site does not show).
  const total = listingTotal;
  const licensed = a.members.filter((m) => m.isLicensed).length;
  const hasAbout = !!a.intro || a.specialties.length > 0 || a.members.length > 0;

  return (
    <>
      <section className={styles.hero} aria-labelledby="office-name">
        <div className={styles.cover}>
          {a.coverUrl ? (
            <Image
              src={a.coverUrl}
              alt={`${a.name} 전경`}
              fill
              priority
              sizes="100vw"
              unoptimized={a.coverUrl.startsWith('/mock-api/')}
            />
          ) : (
            <OfficeCoverArt />
          )}
        </div>
        <div className={cx('container', styles.heroInner)}>
          <div className={styles.heroCard}>
            <OfficeLogo site={site} size={88} className={styles.heroLogo} />
            <div className={styles.identity}>
              <h1 className={styles.heroName} id="office-name">
                {a.name}
              </h1>
              {site.tagline && <p className={styles.tagline}>{site.tagline}</p>}
              <p className={styles.heroMeta}>
                <span>
                  대표 공인중개사 <b>{a.representativeName}</b>
                </span>
                <span className={styles.verified}>
                  <Icon name="shield" size={14} />
                  등록 확인
                </span>
                <OpenStatus hours={a.businessHours} initial={openStateAt(a.businessHours, now)} />
              </p>
            </div>
            <div className={styles.heroSide}>
              <dl className={styles.kpis}>
                {total !== null && (
                  <div className={styles.kpi}>
                    <dt>보유 매물</dt>
                    <dd>
                      <a href="#listings">
                        <b className="num">{formatCount(total)}</b>건
                      </a>
                    </dd>
                  </div>
                )}
                {a.stats?.deals30d != null && (
                  <div className={styles.kpi}>
                    <dt>최근 30일 거래</dt>
                    <dd>
                      <b className="num">{formatCount(a.stats.deals30d)}</b>건
                    </dd>
                  </div>
                )}
                {licensed > 0 && (
                  <div className={styles.kpi}>
                    <dt>공인중개사</dt>
                    <dd>
                      <b className="num">{licensed}</b>명
                    </dd>
                  </div>
                )}
              </dl>
              <OfficeContactActions agency={contact} variant="hero" className={styles.heroActs} />
            </div>
          </div>
        </div>
      </section>

      <div className={cx('container', styles.body)}>
        <section className={styles.sec} id="listings" aria-labelledby="office-listings">
          <div className={styles.secHd}>
            <h2 id="office-listings">
              매물
              {total !== null && (
                <>
                  {' '}
                  <span className="num">{formatCount(total)}</span>건
                </>
              )}
            </h2>
            <p>{a.name}에서 직접 등록한 매물이에요</p>
          </div>
          <Suspense fallback={<Skeleton width="100%" height={320} radius={16} />}>
            <AgencyListings
              agencyId={a.id}
              agencyName={a.name}
              total={total ?? 0}
              countsByAsset={countsByAsset}
              showCounts={countsExact && total !== null}
              initialPage={initialListings}
              initialKey={initialListingsKey}
              primaryOnly
            />
          </Suspense>
        </section>

        {hasAbout && (
          <section className={styles.sec} id="about" aria-labelledby="office-about">
            <div className={styles.secHd}>
              <h2 id="office-about">사무소 소개</h2>
            </div>
            <div className={styles.about}>
              <div className={styles.aboutText}>
                {a.intro ? (
                  <p className={styles.intro}>{a.intro}</p>
                ) : (
                  <p className={styles.muted}>
                    {a.name}의 소개를 준비하고 있어요. 궁금한 점은 문의하기로 남겨 주세요.
                  </p>
                )}
                {a.specialties.length > 0 && (
                  <div>
                    <p className={styles.label}>전문 분야</p>
                    <ul className={styles.chips}>
                      {a.specialties.map((s) => (
                        <li key={s}>
                          <Chip>{SPECIALTY_LABEL[s]}</Chip>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {a.members.length > 0 && (
                <div>
                  <p className={styles.label}>함께 일하는 사람들</p>
                  <ul className={styles.members}>
                    {a.members.map((m) => (
                      <li key={`${m.displayName}-${m.title ?? ''}`} className={styles.member}>
                        <Avatar
                          name={m.displayName}
                          size={44}
                          tone={m.isLicensed ? 'ink' : 'neutral'}
                        />
                        <span className={styles.memberText}>
                          <b>{m.displayName}</b>
                          <span>{memberTitle(m)}</span>
                        </span>
                        {m.isLicensed && (
                          <span className={styles.licensed}>
                            <Icon name="check-circle" size={14} />
                            자격 보유
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <section className={styles.sec} id="location" aria-labelledby="office-location">
          <div className={styles.secHd}>
            <h2 id="office-location">오시는 길</h2>
          </div>
          <div className={styles.location}>
            <div className={styles.mapBox}>
              <AgencyLocationMap
                id={a.id}
                name={a.name}
                lat={a.lat}
                lng={a.lng}
                listingCount={total ?? 0}
              />
            </div>
            <div className={styles.visit}>
              <dl className={styles.visitDl}>
                <div>
                  <dt>
                    <Icon name="map-pin" size={16} />
                    주소
                  </dt>
                  <dd>
                    {address}
                    <a
                      className={styles.directions}
                      href={directionsUrl(a)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${a.name} 길찾기 (새 창)`}
                    >
                      길찾기
                      <Icon name="external-link" size={14} />
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
                    <Icon name="clock" size={16} />
                    영업시간
                  </dt>
                  <dd>
                    {rows.length > 0 ? (
                      <>
                        <OpenStatus
                          hours={a.businessHours}
                          initial={openStateAt(a.businessHours, now)}
                          withHint
                        />
                        <dl className={styles.hours}>
                          {rows.map((r) => (
                            <div key={r.key} className={r.key === today ? styles.today : undefined}>
                              <dt>
                                {r.label}
                                {r.key === today && <span className="sr-only"> (오늘)</span>}
                              </dt>
                              <dd className={r.closed ? styles.closed : undefined}>{r.text}</dd>
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
              </dl>
            </div>
          </div>
        </section>
      </div>

      {/* Phones: 전화 / 문의하기 always in reach (the header only keeps a call icon). */}
      <div className={styles.mBar} role="region" aria-label="전화·문의">
        <OfficeContactActions agency={contact} variant="bar" />
      </div>
    </>
  );
}
