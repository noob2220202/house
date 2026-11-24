'use client';
import {
  AgencyLogo,
  Button,
  ErrorState,
  Icon,
  LoadingRegion,
  Skeleton,
  SkeletonText,
  cx,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useId, type KeyboardEvent, type Ref } from 'react';
import { ROUTES } from '@/config/nav';
import type { AgencyDetail, AgencySummary } from '../api/schemas';
import {
  agencyTagline,
  directionsUrl,
  displayPhone,
  formatResponseTime,
  fullAddress,
  telHref,
} from '../lib/agency';
import { summarizeHours } from '../lib/hours';
import { DealCountBar } from './DealCountBar';
import { MiniListing } from './MiniListing';
import { OfficeCoverArt } from './OfficeCoverArt';
import { OpenStatus } from './OpenStatus';
import { ProfileActions } from './ProfileActions';
import styles from './AgencyProfile.module.css';
import { formatCount } from '@/lib/format';

export interface AgencyProfileProps {
  /** Full profile once loaded. */
  agency?: AgencyDetail;
  /** List item of the same office — shows name/대표 immediately while the profile loads. */
  preview?: AgencySummary;
  isPending?: boolean;
  isError?: boolean;
  /** The office no longer exists (404). */
  notFound?: boolean;
  onRetry?: () => void;
  onClose: () => void;
  ref?: Ref<HTMLElement>;
  className?: string;
}

/**
 * Office profile panel of the search screen (`.od`): cover, identity, intro, 영업시간/주소/등록번호,
 * 보유 매물 counts, 대표 매물 and the 문의하기 / 전화 actions. Non-modal: Escape closes it.
 */
export function AgencyProfile({
  agency,
  preview,
  isPending,
  isError,
  notFound,
  onRetry,
  onClose,
  ref,
  className,
}: AgencyProfileProps) {
  const titleId = useId();
  const head = agency ?? preview;
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <aside
      ref={ref}
      className={cx(styles.od, className)}
      aria-labelledby={head ? titleId : undefined}
      aria-label={head ? undefined : '중개사무소 상세'}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <span className={styles.handle} aria-hidden="true" />
      <div className={styles.scroll}>
        <div className={styles.cover}>
          {agency?.coverUrl ? (
            <Image src={agency.coverUrl} alt="" fill sizes="(max-width: 720px) 100vw, 400px" />
          ) : (
            <OfficeCoverArt />
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="중개사무소 상세 닫기"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {head && (
          <div className={styles.head}>
            <div className={styles.idRow}>
              <AgencyLogo
                className={styles.av}
                name={head.name}
                seed={head.id}
                size={68}
                fallback="initials"
                image={
                  head.logoUrl ? <Image src={head.logoUrl} alt="" fill sizes="68px" /> : undefined
                }
              />
              <ProfileActions agencyId={head.id} agencyName={head.name} />
            </div>
            {agencyTagline(head) && (
              <span className={styles.tag}>
                <Icon name="star" size={14} />
                {agencyTagline(head)}
              </span>
            )}
            <h2 className={styles.name} id={titleId}>
              <Link href={ROUTES.agency(head.id)}>{head.name}</Link>
            </h2>
            <p className={styles.ceo}>
              <span>
                대표 공인중개사 <b>{head.representativeName}</b>
              </span>
              <span className={styles.verified}>
                <Icon name="shield" size={14} />
                등록 확인
              </span>
              <OpenStatus hours={head.businessHours} className={styles.open} />
            </p>
            {agency?.stats &&
              (agency.stats.deals30d != null || agency.stats.avgResponseMinutes != null) && (
                <p className={styles.kpi}>
                  {agency.stats.deals30d != null && (
                    <span>
                      최근 30일 거래 <b className="num">{agency.stats.deals30d}건</b>
                    </span>
                  )}
                  {agency.stats.deals30d != null && agency.stats.avgResponseMinutes != null && (
                    <span className={styles.dot} aria-hidden="true" />
                  )}
                  {agency.stats.avgResponseMinutes != null && (
                    <span>
                      평균 응답{' '}
                      <b className="num">{formatResponseTime(agency.stats.avgResponseMinutes)}</b>
                    </span>
                  )}
                </p>
              )}
          </div>
        )}

        {agency ? (
          <ProfileBody agency={agency} />
        ) : isError ? (
          <div className={styles.state}>
            {notFound ? (
              <ErrorState
                compact
                title="중개사무소를 찾을 수 없어요"
                description="등록이 해지되었거나 주소가 바뀌었을 수 있어요."
                action={
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    목록으로
                  </Button>
                }
              />
            ) : (
              <ErrorState
                compact
                title="상세 정보를 불러오지 못했어요"
                description="잠시 후 다시 시도해 주세요."
                onRetry={onRetry}
              />
            )}
          </div>
        ) : isPending ? (
          <LoadingRegion label="중개사무소 정보를 불러오는 중" className={styles.skeleton}>
            {!head && (
              <>
                <Skeleton width={68} height={68} radius={20} style={{ marginTop: -50 }} />
                <Skeleton width="70%" height={26} />
                <Skeleton width="50%" height={16} />
              </>
            )}
            <SkeletonText lines={2} />
            <Skeleton width="100%" height={96} radius={12} />
            <Skeleton width="40%" height={20} />
            <Skeleton width="100%" height={40} radius={8} />
            <div className={styles.minis}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width="100%" height={76} radius={12} />
              ))}
            </div>
          </LoadingRegion>
        ) : null}
      </div>

      {head && <ProfileCta agency={head} />}
    </aside>
  );
}

function ProfileBody({ agency }: { agency: AgencyDetail }) {
  const hours = summarizeHours(agency.businessHours);
  const total = agency.activeListingCount;
  return (
    <>
      {agency.intro && <p className={styles.intro}>{agency.intro}</p>}
      <dl className={styles.info}>
        <div>
          <dt>
            <Icon name="clock" size={16} />
            영업시간
          </dt>
          <dd>{hours || <span className={styles.muted}>등록된 영업시간이 없어요</span>}</dd>
        </div>
        <div>
          <dt>
            <Icon name="map-pin" size={16} />
            주소
          </dt>
          <dd>
            {fullAddress(agency)}
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
            <Icon name="shield" size={16} />
            등록번호
          </dt>
          <dd className="num">{agency.registrationNumber}</dd>
        </div>
      </dl>
      <section className={styles.sec} aria-label={`보유 매물 ${total}건`}>
        <div className={styles.secHd}>
          <h3>
            보유 매물 <span className="num">{formatCount(total)}</span>건
          </h3>
          <Link className={cx('link', styles.more)} href={`${ROUTES.agency(agency.id)}#listings`}>
            전체 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        <DealCountBar counts={agency.listingCounts} />
        {agency.featuredListings.length > 0 && (
          <>
            <p className={styles.sub}>대표 매물</p>
            <ul className={styles.minis}>
              {agency.featuredListings.slice(0, 3).map((l) => (
                <li key={l.id}>
                  <MiniListing listing={l} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function ProfileCta({ agency }: { agency: AgencySummary }) {
  const tel = telHref(agency.phone);
  return (
    <div className={styles.cta}>
      <Button
        variant="secondary"
        href={`${ROUTES.deal}?agencyId=${encodeURIComponent(agency.id)}`}
        linkAs={Link}
        iconLeft={<Icon name="chat" size={18} />}
      >
        문의하기
      </Button>
      {tel ? (
        <Button
          href={tel}
          iconLeft={<Icon name="phone" size={18} />}
          aria-label={`${agency.name}에 전화 ${displayPhone(agency.phone)}`}
        >
          <span className="num">{displayPhone(agency.phone)}</span>
        </Button>
      ) : (
        <Button href={ROUTES.agency(agency.id)} linkAs={Link}>
          사무소 페이지 보기
        </Button>
      )}
    </div>
  );
}
