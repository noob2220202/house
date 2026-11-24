import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReportsListView } from '@/features/m-moderation/reports/ReportsListView';
import { ListFallback } from '@/features/m-moderation/ui/ListFallback';

export const metadata: Metadata = { title: '신고 관리' };

/** 허위매물 신고 queue (oldest open report first). List state lives in the query string. */
export default function ReportsPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <ReportsListView />
    </Suspense>
  );
}
