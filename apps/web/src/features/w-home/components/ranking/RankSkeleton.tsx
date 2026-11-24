import { LoadingRegion, Skeleton } from '@house/ui';
import styles from './Ranking.module.css';

/** Loading placeholder with the footprint of the ranking (card + 8 rows / card + 3 rows). */
export function RankSkeleton() {
  return (
    <LoadingRegion label="순위를 불러오는 중">
      <div className={`only-lg ${styles.rank}`}>
        <Skeleton height={438} radius="var(--r-xl)" />
        <div className={styles.skTable}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={styles.skRow}>
              <Skeleton width={28} height={28} radius={8} />
              <Skeleton width="34%" height={16} />
              <Skeleton width="28%" height={16} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
      <div className={`only-sm ${styles.rankSm}`}>
        <Skeleton height={160} radius="var(--r-xl)" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={styles.skRow}>
            <Skeleton width={28} height={28} radius={8} />
            <Skeleton width="38%" height={16} />
            <Skeleton width={152} height={44} radius="var(--r-sm)" style={{ marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
