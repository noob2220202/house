import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BannersScreen } from '@/features/m-ads/components/BannersScreen';
import AdsLoading from './loading';

export const metadata: Metadata = { title: '배너·팝업 관리' };

/** /banners — 배너 tab (slot overview, banner list, edit drawer via ?edit / ?new / ?copy). */
export default function BannersPage() {
  return (
    <Suspense fallback={<AdsLoading />}>
      <BannersScreen />
    </Suspense>
  );
}
