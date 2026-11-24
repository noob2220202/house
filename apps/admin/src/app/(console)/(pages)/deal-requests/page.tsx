import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DealRequestsListView } from '@/features/m-moderation/deal-requests/DealRequestsListView';
import { ListFallback } from '@/features/m-moderation/ui/ListFallback';

export const metadata: Metadata = { title: '내놓기·구하기' };

/** 내놓기·구하기 모니터링: every request, spam suspects first-class. State lives in the query string. */
export default function DealRequestsPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <DealRequestsListView />
    </Suspense>
  );
}
