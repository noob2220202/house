import type { ReactNode } from 'react';
import styles from './BackLink.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';
import { Icon } from '../icons/Icon';

export interface BackLinkProps {
  href: string;
  /** Destination in words: "배너 목록", "회원 목록으로". */
  children: ReactNode;
  /** Pass `next/link` from apps. Defaults to a plain `<a>`. */
  linkAs?: LinkAs;
  className?: string;
}

/** "‹ 목록" link above a detail page or form. */
export function BackLink({ href, children, linkAs, className }: BackLinkProps) {
  const Link = linkAs ?? 'a';
  return (
    <Link href={href} className={cx(styles.back, className)}>
      <Icon name="chevron-left" size={18} />
      <span>{children}</span>
    </Link>
  );
}
