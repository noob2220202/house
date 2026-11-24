import type { ReactNode } from 'react';
import styles from './AdFrame.module.css';
import { cx } from '../lib/cx';
import { AdBadge } from './Badge';

export type AdFrameSlot = 'main' | 'mobile' | 'side';

export interface AdFrameProps {
  /** Fixed ratio: main 1240:220 (upload 2480×440) · mobile 358:160 (1074×480) · side 300:250 (600×500). */
  slot: AdFrameSlot;
  /** Click-through URL (the ads click-redirect endpoint). Renders a non-link frame when omitted. */
  href?: string;
  /** Advertiser name for the accessible label: "광고: {label}". */
  label: string;
  /** Banner image (`<Image fill … />`) or custom creative. */
  children: ReactNode;
  /** Overlay controls (pager etc.), positioned top-right. */
  controls?: ReactNode;
  newWindow?: boolean;
  className?: string;
}

/** Fixed-ratio ad frame with the mandatory AD badge. Admin validates uploads against these ratios. */
export function AdFrame({
  slot,
  href,
  label,
  children,
  controls,
  newWindow,
  className,
}: AdFrameProps) {
  const inner = (
    <>
      {children}
      <AdBadge onDark className={styles.badge} />
    </>
  );
  return (
    <div className={cx(styles.frame, styles[slot], className)}>
      {href ? (
        <a
          className={styles.link}
          href={href}
          aria-label={`광고: ${label}`}
          target={newWindow ? '_blank' : undefined}
          rel={newWindow ? 'noopener noreferrer sponsored' : 'sponsored'}
        >
          {inner}
        </a>
      ) : (
        <div className={styles.link} role="img" aria-label={`광고: ${label}`}>
          {inner}
        </div>
      )}
      {controls && <div className={styles.controls}>{controls}</div>}
    </div>
  );
}
