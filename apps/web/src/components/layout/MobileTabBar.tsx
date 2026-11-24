'use client';
import { Icon, cx } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TAB_BAR, isActivePath } from '@/config/nav';
import styles from './MobileTabBar.module.css';

/** Mobile bottom tab bar (≤ 720px): 홈 · 지도 · 내놓기·구하기 · 관심 · MY. Fixed, safe-area aware. */
export function MobileTabBar() {
  const pathname = usePathname();
  // The most specific match wins ("/me/favorites" → 관심, not MY).
  const active = TAB_BAR.filter((t) => isActivePath(pathname, t.match, t.exact)).sort(
    (a, b) => Math.max(...b.match.map((m) => m.length)) - Math.max(...a.match.map((m) => m.length)),
  )[0];
  return (
    <nav className={styles.tabbar} aria-label="하단 메뉴">
      {TAB_BAR.map((tab) => {
        const on = tab === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(styles.tab, on && styles.on)}
            aria-current={on ? 'page' : undefined}
          >
            {tab.cta ? (
              <span className={styles.ctaIcon}>
                <Icon name={tab.icon} size={18} />
              </span>
            ) : (
              <Icon name={tab.icon} size={24} />
            )}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
