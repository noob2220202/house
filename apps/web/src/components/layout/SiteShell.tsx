import { cx } from '@house/ui';
import type { ReactNode } from 'react';
import { MobileHeader, type MobileHeaderProps } from './MobileHeader';
import { MobileTabBar } from './MobileTabBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import styles from './SiteShell.module.css';

export interface SiteShellProps {
  children: ReactNode;
  /** Desktop header (utility bar + GNB). Default true. */
  header?: boolean;
  /** Mobile top bar: `true` (logo + 검색 + 알림), props to customise, or `false` (map / detail pages that draw their own). */
  mobileHeader?: boolean | MobileHeaderProps;
  /** Footer with business info. Turn off on full-height app screens (map). Default true. */
  footer?: boolean;
  /** Mobile bottom tab bar. Turn off on pages with their own sticky CTA bar (listing detail). Default true. */
  tabBar?: boolean;
  /** Full-viewport app layout: main fills the height under the header and does not scroll the page (map). */
  fill?: boolean;
  /** Page background behind cards (`--ground`) instead of white. */
  ground?: boolean;
}

/**
 * Site chrome: skip link, header(s), <main>, footer, mobile tab bar.
 * `app/(site)/layout.tsx` uses the defaults; route groups with other needs compose their own:
 *   <SiteShell footer={false} mobileHeader={false} fill>…</SiteShell>   // map
 */
export function SiteShell({
  children,
  header = true,
  mobileHeader = true,
  footer = true,
  tabBar = true,
  fill,
  ground,
}: SiteShellProps) {
  return (
    <div
      className={cx(
        styles.shell,
        fill && styles.fill,
        tabBar && styles.withTabBar,
        ground && styles.ground,
      )}
    >
      <a href="#main" className={styles.skip}>
        본문 바로가기
      </a>
      {header && <SiteHeader />}
      {mobileHeader !== false && (
        <MobileHeader {...(typeof mobileHeader === 'object' ? mobileHeader : {})} />
      )}
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      {footer && <SiteFooter />}
      {tabBar && <MobileTabBar />}
    </div>
  );
}
