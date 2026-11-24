import { Icon } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  /** id of the <h2> (the section's `aria-labelledby`). */
  id: string;
  title: ReactNode;
  /** One-line caption under the title. */
  caption?: ReactNode;
  /** Controls on the right (desktop). */
  actions?: ReactNode;
  /** Compact "전체 ›" style link shown on mobile instead of `actions`. */
  mobileMore?: { href: string; label: string; ariaLabel?: string };
}

/** Section heading of the home modules: Main `.sec-hd` on desktop, MobileHome `.mh-shd` on mobile. */
export function SectionHeader({ id, title, caption, actions, mobileMore }: SectionHeaderProps) {
  return (
    <div className={mobileMore ? `${styles.header} ${styles.compact}` : styles.header}>
      <div className={styles.text}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {caption && <p className={styles.caption}>{caption}</p>}
      </div>
      {actions && (
        <div className={`${styles.actions} ${mobileMore ? 'only-lg' : ''}`}>{actions}</div>
      )}
      {mobileMore && (
        <Link
          href={mobileMore.href}
          className={`only-sm ${styles.more}`}
          aria-label={mobileMore.ariaLabel}
        >
          {mobileMore.label}
          <Icon name="chevron-right" size={16} />
        </Link>
      )}
    </div>
  );
}

/** "전체 보기 ›" text link used in desktop section headers. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`link ${styles.moreLink}`}>
      {children}
      <Icon name="chevron-right" size={16} />
    </Link>
  );
}
