import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TradeSyncView } from '@/features/m-content/complexes/TradeSyncView';

export const metadata: Metadata = { title: '실거래가 동기화' };

export default function TradeSyncPage() {
  return (
    <Suspense>
      <TradeSyncView />
    </Suspense>
  );
}
