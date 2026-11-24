import type { ReactNode } from 'react';
import styles from './Breadcrumb.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';
import { Icon } from '../icons/Icon';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
  linkAs?: LinkAs;
  className?: string;
}

/** Page breadcrumb. The last item is the current page. */
export function Breadcrumb({ items, linkAs, className }: BreadcrumbProps) {
  const Link = linkAs ?? 'a';
  return (
    <nav aria-label="현재 위치" className={cx(styles.nav, className)}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={styles.item}>
              {item.href && !last ? (
                <Link href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? styles.current : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <Icon name="chevron-right" size={14} className={styles.sep} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
