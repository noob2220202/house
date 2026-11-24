import { ErrorState, Icon, Skeleton, cx } from '@house/ui';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import styles from './dashboard.module.css';

export interface DashPanelProps {
  title: string;
  /** Brand-coloured count after the title. */
  count?: number;
  caption?: ReactNode;
  /** "더 보기" link on the right of the header. */
  more?: { label: string; href: string };
  /** Custom right side of the header (legend, segmented control) instead of `more`. */
  actions?: ReactNode;
  /** Anchor id (e.g. "approvals"). */
  id?: string;
  /** Stretch to fill the remaining column height. */
  grow?: boolean;
  children: ReactNode;
}

/** Dashboard panel (`.panel` + `.panel-hd` of the draft): title · count · caption · more link. */
export function DashPanel({
  title,
  count,
  caption,
  more,
  actions,
  id,
  grow,
  children,
}: DashPanelProps) {
  const headingId = useId();
  return (
    <section id={id} className={cx(styles.panel, grow && styles.grow)} aria-labelledby={headingId}>
      <div className={styles.panelHd}>
        <div className={styles.hdL}>
          <h2 className={styles.panelT} id={headingId}>
            {title}
            {count !== undefined && (
              <span className={styles.cnt}>
                {count.toLocaleString('ko-KR')}
                <span className="sr-only">건</span>
              </span>
            )}
          </h2>
          {caption && <p className={styles.cap}>{caption}</p>}
        </div>
        {actions ? (
          <div className={styles.hdR}>{actions}</div>
        ) : (
          more && (
            <Link className={styles.more} href={more.href}>
              {more.label}
              <Icon name="chevron-right" size={16} />
            </Link>
          )
        )}
      </div>
      {children}
    </section>
  );
}

/** Centered state area inside a panel (empty / error). */
export function PanelState({ children }: { children: ReactNode }) {
  return <div className={styles.panelState}>{children}</div>;
}

export function PanelError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <PanelState>
      <ErrorState
        compact
        title={`${what} 불러오지 못했어요`}
        description="잠시 후 다시 시도해 주세요."
        onRetry={onRetry}
      />
    </PanelState>
  );
}

/** Row skeletons with the footprint of a list / table row. */
export function PanelRowsSkeleton({ rows = 3, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skRow} style={{ minHeight: tall ? 64 : 48 }}>
          <div className={styles.skCol}>
            <Skeleton width={`${62 - (i % 3) * 9}%`} height={14} />
            {tall && <Skeleton width={`${44 + (i % 2) * 12}%`} height={12} />}
          </div>
          <Skeleton width={72} height={24} radius={999} />
        </div>
      ))}
    </div>
  );
}
