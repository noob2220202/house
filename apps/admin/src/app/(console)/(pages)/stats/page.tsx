import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StatsView } from '@/features/m-content/stats/StatsView';

export const metadata: Metadata = { title: '통계' };

export default function StatsPage() {
  return (
    <Suspense>
      <StatsView />
    </Suspense>
  );
}
