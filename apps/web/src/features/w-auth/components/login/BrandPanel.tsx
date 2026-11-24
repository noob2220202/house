import { BrokersBadge, DealBadge, Icon, VerifiedBadge } from '@house/ui';
import Image, { type StaticImageData } from 'next/image';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';
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
 * skyline of Suncheon. Purely decorative below the copy — the floating cards are sample data.
 */
export function BrandPanel() {
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
        <div className={`${styles.float} ${styles.fcAlert}`}>
          <span className={styles.fcIc}>
            <Icon name="bell" size={18} />
          </span>
          <div className={styles.fcBody}>
            <p className={styles.fcK}>관심 단지 새 매물 · 방금</p>
            <p className={styles.fcT}>
              신대 레이크파크 1단지 <span>103동 · 고/25층 · 34평</span>
            </p>
            <p className={styles.fcP}>
              <DealBadge deal="sale" />
              <span className="price price-sm num">4억 4,500</span>
            </p>
            <p className={styles.fcM}>
              <VerifiedBadge date="26.11.22" className={styles.fcVerified} />
              <BrokersBadge count={3} light />
            </p>
          </div>
        </div>
        <div className={`${styles.float} ${styles.fcSent}`}>
          <span className={styles.fcOk}>
            <Icon name="check" size={16} strokeWidth={2.5} />
          </span>
          <p>
            <b>구하기 요청 전달 완료</b>
            <span>신대·선월 중개사무소 12곳</span>
          </p>
        </div>
      </div>
    </div>
  );
}
