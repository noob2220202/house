import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AgencySitesListView } from '@/features/m-moderation/agencies/AgencySitesListView';
import { ListFallback } from '@/features/m-moderation/ui/ListFallback';

export const metadata: Metadata = { title: '사무소 홈페이지' };

/** 사무소 홈페이지 신청 queue + office sites by state. List state lives in the query string. */
export default function AgencySitesPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <AgencySitesListView />
    </Suspense>
  );
}
