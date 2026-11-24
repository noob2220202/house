import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListingsListView } from '@/features/m-moderation/listings/ListingsListView';
import { ListFallback } from '@/features/m-moderation/ui/ListFallback';

export const metadata: Metadata = { title: '매물 관리' };

/** 매물 검수: listing search + the 검수 필요 queue. List state lives in the query string. */
export default function ListingsPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <ListingsListView />
    </Suspense>
  );
}
