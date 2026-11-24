import { LoadingRegion, Skeleton } from '@house/ui';
import s from './ui.module.css';

/** Suspense fallback of a list page (tabs row + table panel). */
export function ListFallback() {
  return (
    <LoadingRegion className={s.page}>
      <Skeleton height={48} radius={8} />
      <Skeleton height={520} radius={16} />
    </LoadingRegion>
  );
}
