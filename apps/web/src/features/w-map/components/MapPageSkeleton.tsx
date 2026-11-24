import { Skeleton } from '@house/ui';
import type { MapAssetSlug } from '@/config/nav';
import { ASSETS } from '../config/assets';
import s from './MapPageSkeleton.module.css';

/**
 * Server-rendered placeholder of the map screen (Suspense fallback): the same boxes as the real
 * layout on desktop and mobile, so nothing shifts when the client takes over.
 */
export function MapPageSkeleton({ slug }: { slug: MapAssetSlug }) {
  const asset = ASSETS[slug];
  const complex = asset.listMode === 'complex';
  return (
    <div className={s.page} aria-busy="true">
      <h1 className="sr-only">순천 {asset.label} 지도</h1>
      <p className="sr-only">{asset.seo.description}</p>
      <div className={s.bar} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width={i < 2 ? 150 : 104} height={40} radius={999} />
        ))}
      </div>
      <div className={complex ? s.bodyComplex : s.bodyListing}>
        <div className={s.panel} aria-hidden="true">
          <Skeleton height={44} radius={999} />
          <Skeleton width="70%" height={28} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={s.row}>
              <Skeleton width={64} height={64} radius={12} />
              <div className={s.rowMain}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="45%" height={14} />
                <Skeleton height={40} radius={8} />
              </div>
            </div>
          ))}
        </div>
        <div className={s.map} aria-hidden="true" />
      </div>
      <div className={s.sheet} aria-hidden="true">
        <span className={s.handle} />
        <Skeleton width="55%" height={26} />
        <Skeleton width="80%" height={14} />
        <Skeleton height={56} radius={8} />
        <Skeleton height={60} radius={12} />
      </div>
    </div>
  );
}
