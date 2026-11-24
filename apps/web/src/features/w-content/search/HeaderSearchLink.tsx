'use client';
import { Icon } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/config/nav';
import styles from './search.module.css';

const SEARCH_PATH = ROUTES.search('').split('?')[0] ?? '/search';

/**
 * Desktop header entry to unified search, for foundation's `SiteHeader` (place it first inside
 * `.act`, before 내놓기): a round 44px 검색 button linking to /search, where the autocomplete field
 * has focus. A full pill does not fit the GNB at 1440px (about 200px are free between the menu and
 * the CTAs), so the header gets the icon and /search carries the field. Hidden on the home page
 * (the hero has its own search) and on /search itself.
 */
export function HeaderSearchLink() {
  const pathname = usePathname();
  if (pathname === ROUTES.home || pathname === SEARCH_PATH) return null;
  return (
    <Link
      href={SEARCH_PATH}
      className={styles.headerSearch}
      aria-label="통합 검색"
      title="통합 검색"
    >
      <Icon name="search" size={20} />
    </Link>
  );
}
