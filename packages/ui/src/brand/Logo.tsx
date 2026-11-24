import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';
import styles from './Logo.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';

export interface LogoProps {
  /** Wordmark text — comes from the app's brand config. */
  name: string;
  /** Link target; omit to render a non-link lockup. */
  href?: string;
  linkAs?: LinkAs;
  /** `ink` = white wordmark for dark surfaces (admin sidebar). */
  tone?: 'default' | 'ink';
  /** Mark size in px (32 desktop, 28 mobile header, 30 admin). */
  size?: number;
  /** Replace the default mark. */
  mark?: ReactNode;
  /** Hide the wordmark (mark only). */
  markOnly?: boolean;
  className?: string;
}

/** Brand lockup: abstract mark + wordmark. */
export function Logo({
  name,
  href,
  linkAs,
  tone = 'default',
  size = 32,
  mark,
  markOnly,
  className,
}: LogoProps) {
  const content = (
    <>
      {mark ?? <BrandMark size={size} />}
      {!markOnly && (
        <span className={styles.word} style={size < 32 ? { fontSize: 19 } : undefined}>
          {name}
        </span>
      )}
    </>
  );
  const cls = cx(styles.logo, tone === 'ink' && styles.ink, className);
  if (!href) return <span className={cls}>{content}</span>;
  const Comp = linkAs ?? 'a';
  return (
    <Comp href={href} className={cls} aria-label={`${name} 홈`}>
      {content}
    </Comp>
  );
}
