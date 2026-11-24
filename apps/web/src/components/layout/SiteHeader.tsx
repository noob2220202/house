import { Icon } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES, UTILITY_NAV } from '@/config/nav';
import { Logo } from '@/components/brand/Logo';
import { GnbNav } from './GnbNav';
import { HeaderAuth } from './HeaderAuth';
import styles from './SiteHeader.module.css';

/** Desktop header per design: utility bar + GNB (logo · nav · 내놓기 / 구하기 / 로그인). Hidden ≤ 720px. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.utilbar}>
        <div className={`container ${styles.utilInner}`}>
          <span>{BRAND.slogan}</span>
          <nav className={styles.utilNav} aria-label="보조 메뉴">
            {UTILITY_NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className={styles.gnb}>
        <div className={`container ${styles.gnbInner}`}>
          <Logo className={styles.logoFull} />
          {/* ≤ 960px: the mark alone (the link keeps its "… 홈" name) so the whole GNB fits. */}
          <Logo markOnly className={styles.logoMark} />
          <GnbNav />
          <div className={styles.act}>
            {/* ≤ 1180px the CTAs shrink to icon buttons; the label stays for screen readers. */}
            <Link
              className={`${styles.cta} ${styles.sell}`}
              href={ROUTES.dealSell}
              aria-label="내놓기"
            >
              <Icon name="home-up" size={18} />
              <span className={styles.ctaLabel}>내놓기</span>
            </Link>
            <Link
              className={`${styles.cta} ${styles.find}`}
              href={ROUTES.dealFind}
              aria-label="구하기"
            >
              <Icon name="home-search" size={18} />
              <span className={styles.ctaLabel}>구하기</span>
            </Link>
            <HeaderAuth />
          </div>
        </div>
      </div>
    </header>
  );
}
