import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AgenciesListView } from '@/features/m-moderation/agencies/AgenciesListView';
import { ListFallback } from '@/features/m-moderation/ui/ListFallback';

export const metadata: Metadata = { title: '중개사 관리' };

/**
 * 중개사무소 승인 queue + office search. List state lives in the query string.
 * A search that arrives without a tab (topbar search → "더 보기") looks through every office, not
 * only the approval queue.
 */
export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[] }>;
}) {
  const { q, status } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim();
  if (query && !status) redirect(`/agencies?status=ALL&q=${encodeURIComponent(query)}`);
  return (
    <Suspense fallback={<ListFallback />}>
      <AgenciesListView />
    </Suspense>
  );
}
