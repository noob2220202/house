import { LoadingRegion, Skeleton } from '@house/ui';
import layout from '@/features/w-content/components/layout.module.css';

export default function SearchLoading() {
  return (
    <LoadingRegion className={`container ${layout.page}`} label="검색하는 중">
      <div style={{ paddingTop: 32 }}>
        <Skeleton width={120} height={14} />
        <Skeleton width="min(320px, 80%)" height={40} style={{ marginTop: 20 }} />
        <Skeleton width="min(720px, 100%)" height={64} radius={16} style={{ marginTop: 28 }} />
      </div>
      <Skeleton height={48} radius={8} style={{ marginTop: 32 }} />
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          marginTop: 32,
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={132} radius={24} />
        ))}
      </div>
    </LoadingRegion>
  );
}
