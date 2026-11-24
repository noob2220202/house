import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PopupsScreen } from '@/features/m-ads/components/PopupsScreen';
import AdsLoading from '../loading';

export const metadata: Metadata = { title: '팝업 관리' };

/** /banners/popups — 팝업 tab (popup list, edit drawer via ?edit / ?new / ?copy). */
export default function PopupsPage() {
  return (
    <Suspense fallback={<AdsLoading />}>
      <PopupsScreen />
    </Suspense>
  );
}
