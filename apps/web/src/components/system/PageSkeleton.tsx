import { ListingCardSkeleton, LoadingRegion, Skeleton } from '@house/ui';

/** Generic page-level loading skeleton (title + card grid). Page groups add route-specific loading.tsx files. */
export function PageSkeleton() {
  return (
    <LoadingRegion className="container section">
      <Skeleton width={120} height={14} />
      <Skeleton width="min(420px, 80%)" height={40} style={{ marginTop: 14 }} />
      <Skeleton width="min(520px, 100%)" height={16} style={{ marginTop: 16 }} />
      <div className="grid-auto" style={{ marginTop: 40 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </LoadingRegion>
  );
}
