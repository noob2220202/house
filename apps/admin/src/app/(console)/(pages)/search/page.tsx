import type { Metadata } from 'next';
import { SearchView } from '@/features/m-core/components/search/SearchView';

export const metadata: Metadata = { title: '통합 검색' };

/** Global search results for the topbar search field: /search?q=… */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  return <SearchView query={(Array.isArray(q) ? q[0] : q) ?? ''} />;
}
