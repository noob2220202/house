'use client';
import { Icon, PhotoPlaceholder, cx } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { ROUTES } from '@/config/nav';
import type { ListingAgency } from '../api/schemas';
import { mediaImage } from '../lib/media';
import { displayPhone, telHref } from '../lib/view';
import { Glyph } from './icons';
import { useListingInteractions } from './ListingInteractions';
import styles from './side.module.css';

export interface BrokersCardProps {
  agencies: readonly ListingAgency[];
  /** Unique id prefix — the card is rendered twice (aside on wide screens, in the flow below). */
  idPrefix: string;
  className?: string;
}

/**
 * 공동중개 사무소 목록. Every office shows the 공인중개사법 표시·광고 명시사항
 * (명칭 · 소재지 · 연락처 · 등록번호 · 대표 성명) and has call / 문의 actions.
 */
export function BrokersCard({ agencies, idPrefix, className }: BrokersCardProps) {
  const { openContact } = useListingInteractions();
  const count = agencies.length;
  const headingId = `${idPrefix}-brokers`;

  // Desktop has no dialer: the 전화 link opens the contact dialog (number + copy) instead.
  const onCall = (e: MouseEvent<HTMLAnchorElement>, agencyId: string) => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      e.preventDefault();
      openContact(agencyId);
    }
  };

  return (
    <section className={cx(styles.scard, styles.brokers, className)} aria-labelledby={headingId}>
      <div className={styles.scardHd}>
        <h2 className={styles.scardT} id={headingId}>
          <span className={styles.brokersTLg}>이 매물을 중개하는 사무소</span>
          <span className={styles.brokersTSm}>공동중개 사무소</span>{' '}
          <span className={cx(styles.brand, 'num')}>{count}곳</span>
        </h2>
        <p className={styles.scardDesc}>
          {count > 1
            ? '같은 매물을 여러 사무소가 함께 중개해요. 어디에 문의해도 같은 집이에요.'
            : '이 매물을 등록한 중개사무소예요.'}
        </p>
      </div>
      {count === 0 ? (
        <p className={styles.brokersEmpty}>중개사무소 정보를 확인하고 있어요.</p>
      ) : (
        <ol className={styles.cbs}>
          {agencies.map((a, i) => {
            const phone = a.contactPhone ?? a.phone;
            return (
              <li key={a.agencyId} className={cx(styles.cb, i === 0 && styles.cbFirst)}>
                <span className={styles.cbPh}>
                  {a.logoUrl ? (
                    <Image {...mediaImage(a.logoUrl)} alt="" fill sizes="56px" />
                  ) : (
                    <PhotoPlaceholder kind="office" />
                  )}
                </span>
                <div className={styles.cbInfo}>
                  {i === 0 && (
                    <span className={styles.cbTag}>
                      <Icon name="star" size={14} />
                      {[a.specialtyTag, a.isPrimary ? '최초 등록' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                  <h3 className={styles.cbName}>
                    <Link href={ROUTES.agency(a.agencyId)}>{a.name}</Link>
                  </h3>
                  <p className={styles.cbMeta}>
                    <span className={styles.cbRep}>
                      대표<span className={styles.cbRepLg}> 공인중개사</span> {a.representativeName}
                    </span>
                    {a.activeListingCount !== null && a.activeListingCount !== undefined && (
                      <span>
                        <span className={styles.cbStatLg}>보유 </span>매물{' '}
                        <b className="num">{a.activeListingCount}</b>
                      </span>
                    )}
                    {a.avgResponseMinutes !== null && a.avgResponseMinutes !== undefined && (
                      <span>
                        평균 응답 <b className="num">{a.avgResponseMinutes}분</b>
                      </span>
                    )}
                  </p>
                </div>
                <dl className={styles.cbLegal}>
                  <div>
                    <dt>소재지</dt>
                    <dd>{[a.roadAddress, a.addressDetail].filter(Boolean).join(', ')}</dd>
                  </div>
                  <div>
                    <dt>연락처</dt>
                    <dd className="num">{displayPhone(a.phone)}</dd>
                  </div>
                  <div>
                    <dt>등록번호</dt>
                    <dd className="num">{a.registrationNumber}</dd>
                  </div>
                </dl>
                <div className={styles.cbAct}>
                  <a
                    className={cx(styles.cbBtn, styles.cbCall)}
                    href={telHref(phone)}
                    aria-label={`${a.name} 전화하기, ${displayPhone(phone)}`}
                    onClick={(e) => onCall(e, a.agencyId)}
                  >
                    <Icon name="phone" size={18} />
                    <span>전화</span>
                  </a>
                  <button
                    type="button"
                    className={cx(styles.cbBtn, i === 0 ? styles.cbAskPrimary : styles.cbAsk)}
                    aria-label={`${a.name}에 문의하기`}
                    onClick={() => openContact(a.agencyId)}
                  >
                    <Glyph name="message" size={18} />
                    <span>문의하기</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className={styles.scardFt}>
        <Icon name="info" size={16} />
        중개보수는 어느 사무소든 법정 상한 안에서 협의해요.
      </p>
    </section>
  );
}
