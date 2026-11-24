import { LoadingRegion, Skeleton } from '@house/ui';
import styles from './AgencySearch.module.css';

/** Route-level skeleton of 중개사무소 찾기: same grid as the real screen, so nothing shifts. */
export function AgencySearchSkeleton() {
  return (
    <LoadingRegion label="중개사무소 찾기를 불러오는 중" className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.head}>
          <Skeleton width={160} height={28} />
          <Skeleton width="100%" height={48} radius={12} />
          <div className={styles.spec}>
            {[52, 76, 92, 60, 60].map((w, i) => (
              <Skeleton key={i} width={w} height={36} radius={999} />
            ))}
          </div>
          <div className={styles.filt}>
            {[132, 108, 92].map((w, i) => (
              <Skeleton key={i} width={w} height={36} radius={999} />
            ))}
          </div>
        </div>
        <div className={styles.sum}>
          <Skeleton width={120} height={18} />
          <Skeleton width={88} height={18} />
        </div>
        <div className={styles.listWrap}>
          <div className={styles.list}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.skCard}>
                <div className={styles.skTop}>
                  <Skeleton width={56} height={56} radius={12} />
                  <div className={styles.skLines}>
                    <Skeleton width="70%" height={18} />
                    <Skeleton width="55%" height={14} />
                    <Skeleton width="65%" height={14} />
                  </div>
                </div>
                <div className={styles.skFoot}>
                  <Skeleton width={150} height={28} radius={6} />
                  <Skeleton width={72} height={36} radius={8} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.mapv}>
        <Skeleton width="100%" height="100%" radius={0} />
      </div>
    </LoadingRegion>
  );
}
