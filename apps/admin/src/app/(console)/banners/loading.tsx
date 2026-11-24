import { LoadingRegion, Skeleton } from '@house/ui';

/** Skeleton with the footprint of the banners / popups screens. */
export default function AdsLoading() {
  return (
    <LoadingRegion label="배너·팝업 관리 불러오는 중">
      <Skeleton height={46} radius={8} />
      <div
        style={{
          display: 'grid',
          gap: 10,
          marginTop: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        }}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} height={143} radius={16} />
        ))}
      </div>
      <Skeleton height={420} radius={16} style={{ marginTop: 16 }} />
    </LoadingRegion>
  );
}
