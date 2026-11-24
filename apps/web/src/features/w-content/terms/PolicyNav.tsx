import { cx } from '@house/ui';
import Link from 'next/link';
import { POLICY_DOCS, policyHref, type PolicySlug } from './policies';
import styles from './terms.module.css';

/** Document switcher: vertical list on desktop (sticky), horizontally scrolling pills on mobile. */
export function PolicyNav({ current }: { current: PolicySlug }) {
  return (
    <nav className={styles.nav} aria-label="약관 · 정책 문서">
      <ul className={styles.navList}>
        {POLICY_DOCS.map((doc) => {
          const on = doc.slug === current;
          return (
            <li key={doc.slug}>
              <Link
                href={policyHref(doc.slug)}
                className={cx(styles.navItem, on && styles.navOn)}
                aria-current={on ? 'page' : undefined}
              >
                {doc.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
