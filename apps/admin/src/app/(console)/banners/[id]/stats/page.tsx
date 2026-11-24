import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StatsScreen } from '@/features/m-ads/components/StatsScreen';
import AdsLoading from '../../loading';

export const metadata: Metadata = { title: '배너 통계' };

/** /banners/:id/stats — daily impressions / clicks / CTR of one banner (?range=7|14|30|all or ?from&to). */
export default async function BannerStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<AdsLoading />}>
      <StatsScreen bannerId={id} />
    </Suspense>
  );
}
