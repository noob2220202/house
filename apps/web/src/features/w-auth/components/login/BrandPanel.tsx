import { BrokersBadge, DealBadge, Icon, VerifiedBadge } from '@house/ui';
import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';
import type { BrandPanelFacts } from '../../lib/brand-facts';
import nightArt from '../../assets/auth-night.svg';
import styles from './login.module.css';

// Typed explicitly: the type-aware linter does not pick up Next's ambient '*.svg' module declaration.
const NIGHT_ART = nightArt as StaticImageData;

const PERKS = [
  { icon: 'bell', text: '관심 단지에 새 매물이 오르면 바로 알림' },
  { icon: 'home-search', text: '내놓기·구하기 요청을 근처 중개사무소에 한 번에' },
  { icon: 'chat', text: '여러 중개사와 나눈 문의를 한곳에서' },
] as const;

/**
 * Left half of the split login (Login.dc.html): ink panel with the service promise and the night
 * skyline of Suncheon. The floating cards (`cards`, usually `<BrandFloatCards>` streamed in a
 * Suspense boundary) show only real data from the API — never sample listings or counts.
 */
export function BrandPanel({ cards }: { cards?: ReactNode }) {
  return (
    <div className={styles.brand}>
      <div className={styles.brandTop}>
        <Logo tone="ink" />
      </div>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{BRAND.tagline}</p>
        <p className={styles.display}>
          순천의 모든 집,
          <br />
          동네 중개사가 함께 찾아드려요
        </p>
        <ul className={styles.perks}>
          {PERKS.map((perk) => (
            <li key={perk.text}>
              <Icon name={perk.icon} size={18} />
              {perk.text}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.illu} aria-hidden="true">
        <span className={styles.moon} />
        <Image className={styles.illuArt} src={NIGHT_ART} alt="" priority unoptimized />
        {cards}
      </div>
    </div>
  );
}

/**
 * The two floating cards of the night illustration, built from real facts only: the newest public
 * listing that passed 실매물 확인 (name, 면적, 거래 유형, 가격, 확인일 — never 동/호), else the
 * latest 국토교통부 실거래 of a real 단지 with its source and 계약월; and the number of approved
 * offices. A card without data is left out.
 */
export function BrandFloatCards({ facts }: { facts: BrandPanelFacts }) {
  const { highlight, agencyCount } = facts;
  return (
    <>
      {highlight?.kind === 'listing' && (
        <div className={`${styles.float} ${styles.fcAlert}`} data-testid="brand-listing-card">
          <span className={styles.fcIc}>
            <Icon name="bell" size={18} />
          </span>
          <div className={styles.fcBody}>
            <p className={styles.fcK}>최근 실매물 확인</p>
            <p className={styles.fcT}>
              {highlight.title} {highlight.area && <span>{highlight.area}</span>}
            </p>
            <p className={styles.fcP}>
              <DealBadge deal={highlight.deal}>{highlight.dealLabel}</DealBadge>
              <span className="price price-sm num">{highlight.price}</span>
            </p>
            <p className={styles.fcM}>
              <VerifiedBadge date={highlight.verifiedDate} className={styles.fcVerified} />
              <BrokersBadge count={highlight.brokerCount} light />
            </p>
          </div>
        </div>
      )}
      {highlight?.kind === 'trade' && (
        <div className={`${styles.float} ${styles.fcAlert}`} data-testid="brand-trade-card">
          <span className={styles.fcIc}>
            <Icon name="chart" size={18} />
          </span>
          <div className={styles.fcBody}>
            <p className={styles.fcK}>국토교통부 실거래가 · {highlight.monthLabel} 계약</p>
            <p className={styles.fcT}>
              {highlight.title} {highlight.emdName && <span>{highlight.emdName}</span>}
            </p>
            <p className={styles.fcP}>
              <DealBadge deal="sale" />
              <span className="price price-sm num">{highlight.medianPrice}</span>
            </p>
            <p className={styles.fcM}>
              <span className={styles.fcSource}>
                중위 거래가 · 거래 {highlight.tradeCount.toLocaleString('ko-KR')}건
              </span>
            </p>
          </div>
        </div>
      )}
      {agencyCount !== null && (
        <div className={`${styles.float} ${styles.fcSent}`} data-testid="brand-agency-card">
          <span className={styles.fcOk}>
            <Icon name="check" size={16} strokeWidth={2.5} />
          </span>
          <p>
            <b>구하기 요청 한 번에 전달</b>
            <span>순천 중개사무소 {agencyCount.toLocaleString('ko-KR')}곳</span>
          </p>
        </div>
      )}
    </>
  );
}
