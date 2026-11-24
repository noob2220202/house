import { LoadingRegion, Skeleton } from '@house/ui';

export default function ConsoleLoading() {
  return (
    <LoadingRegion>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
        }}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={96} radius={16} />
        ))}
      </div>
      <Skeleton height={320} radius={16} style={{ marginTop: 20 }} />
    </LoadingRegion>
  );
}
