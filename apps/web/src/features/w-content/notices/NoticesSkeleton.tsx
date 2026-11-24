import { LoadingRegion, Skeleton } from '@house/ui';
import layout from '../components/layout.module.css';
import styles from './notices.module.css';

/** Loading skeleton with the footprint of the notice list page. */
export function NoticesSkeleton() {
  return (
    <LoadingRegion className={`container ${layout.page}`}>
      <div style={{ paddingTop: 32 }}>
        <Skeleton width={160} height={14} />
        <Skeleton width={180} height={40} style={{ marginTop: 20 }} />
        <Skeleton width="min(360px, 80%)" height={18} style={{ marginTop: 12 }} />
      </div>
      <Skeleton height={48} style={{ marginTop: 28 }} radius={8} />
      <div style={{ marginTop: 32, borderTop: '1px solid var(--line)' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={styles.skRow}>
            <Skeleton width={40} height={22} style={{ justifySelf: 'center' }} />
            <Skeleton width={`${72 - (i % 4) * 9}%`} height={18} />
            <Skeleton width={100} height={14} />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Loading skeleton of the notice detail page. */
export function NoticeDetailSkeleton() {
  return (
    <LoadingRegion className={`container ${layout.page} ${layout.narrow}`}>
      <div style={{ paddingTop: 32 }}>
        <Skeleton width={220} height={14} />
        <Skeleton width="min(560px, 90%)" height={34} style={{ marginTop: 28 }} />
        <Skeleton width={180} height={14} style={{ marginTop: 16 }} />
      </div>
      <div style={{ marginTop: 28, borderTop: '1px solid var(--line)', paddingTop: 36 }}>
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton
            key={i}
            height={16}
            width={`${[100, 96, 88, 60, 100, 92, 74, 98, 45][i]}%`}
            style={{ marginTop: i === 4 ? 32 : 14, display: 'block' }}
          />
        ))}
      </div>
    </LoadingRegion>
  );
}
