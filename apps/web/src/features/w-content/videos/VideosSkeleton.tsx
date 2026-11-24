import { LoadingRegion, Skeleton } from '@house/ui';
import layout from '../components/layout.module.css';
import styles from './videos.module.css';

/** Loading skeleton with the footprint of the 동네TV page (featured player + list + grid). */
export function VideosSkeleton() {
  return (
    <LoadingRegion className={`container ${layout.page}`}>
      <div style={{ paddingTop: 32 }}>
        <Skeleton width={160} height={14} />
        <Skeleton width={220} height={40} style={{ marginTop: 20 }} />
        <Skeleton width="min(360px, 80%)" height={18} style={{ marginTop: 12 }} />
      </div>
      <div className={styles.stage} style={{ marginTop: 32 }}>
        <div className={styles.feat}>
          <Skeleton height="auto" radius={16} style={{ aspectRatio: '16 / 9' }} />
          <Skeleton width="80%" height={24} />
          <Skeleton width="40%" height={14} />
        </div>
        <div className={styles.nextList}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={styles.vrow}>
              <Skeleton width="44%" height="auto" radius={16} style={{ aspectRatio: '16 / 9' }} />
              <div className={styles.vtext} style={{ flex: 1 }}>
                <Skeleton height={18} />
                <Skeleton width="70%" height={18} />
                <Skeleton width="50%" height={12} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
