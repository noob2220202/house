import { Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import styles from './DealQuick.module.css';

/** Mobile-only pair of 내놓기 / 구하기 entries under the ad (MobileHome `.deal2`). */
export function DealQuick() {
  return (
    <section className={`only-sm ${styles.section}`} aria-label="내놓기와 구하기">
      <div className={`container ${styles.grid}`}>
        <Link href={ROUTES.dealSell} className={`${styles.card} ${styles.ink}`}>
          <span className={styles.title}>
            <span className={styles.icon}>
              <Icon name="home-up" size={18} />
            </span>
            내놓기
            <Icon name="chevron-right" size={18} className={styles.chev} />
          </span>
          <span className={styles.sub}>집을 내놓을 생각이 있나요?</span>
        </Link>
        <Link href={ROUTES.dealFind} className={styles.card}>
          <span className={styles.title}>
            <span className={styles.icon}>
              <Icon name="home-search" size={18} />
            </span>
            구하기
            <Icon name="chevron-right" size={18} className={styles.chev} />
          </span>
          <span className={styles.sub}>찾는 조건의 집이 없나요?</span>
        </Link>
      </div>
    </section>
  );
}
