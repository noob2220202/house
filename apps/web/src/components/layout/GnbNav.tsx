'use client';
import { cx } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath, type NavItem } from '@/config/nav';
import styles from './SiteHeader.module.css';

function Item({ item, pathname }: { item: NavItem; pathname: string }) {
  const on = isActivePath(pathname, item.match);
  return (
    <Link
      href={item.href}
      className={cx(styles.navLink, on && styles.on)}
      aria-current={on ? 'page' : undefined}
    >
      {item.label}
    </Link>
  );
}

/** GNB links with the active item derived from the current path. */
export function GnbNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      {PRIMARY_NAV.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} />
      ))}
      <span className={styles.sep} aria-hidden="true" />
      {SECONDARY_NAV.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
