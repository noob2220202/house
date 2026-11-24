import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VideosView } from '@/features/m-content/videos/VideosView';

export const metadata: Metadata = { title: '동네TV 관리' };

export default function VideosPage() {
  return (
    <Suspense>
      <VideosView />
    </Suspense>
  );
}
