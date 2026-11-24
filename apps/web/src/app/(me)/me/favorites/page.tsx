import { HydrationBoundary } from '@tanstack/react-query';
import {
  FavoritesDescription,
  FavoritesView,
  type FavoritesTab,
} from '@/features/w-me/components/FavoritesView';
import { MePage } from '@/features/w-me/components/MePage';
import { MobileBellLink } from '@/features/w-me/components/MobileBellLink';
import { parsePageParam } from '@/features/w-me/lib/params';
import { ME_ROUTES } from '@/features/w-me/routes';
import { prefetchFavorites, requireMe } from '@/features/w-me/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '관심 매물·단지',
  description: '하트로 담아 둔 매물과 단지를 한곳에서 확인하세요.',
  path: ME_ROUTES.favorites,
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// `?tab=` / `?page=` are read here only for the first render (guard return path + prefetch). After
// that the view follows the URL on the client: tabs and pagination do not navigate on the server.
export default async function FavoritesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab: FavoritesTab = sp.tab === 'complexes' ? 'complexes' : 'listings';
  const page = parsePageParam(sp.page);
  const [, state] = await Promise.all([
    requireMe(tab === 'complexes' ? ME_ROUTES.favoriteComplexes : ME_ROUTES.favorites),
    prefetchFavorites(tab, page),
  ]);
  return (
    <HydrationBoundary state={state}>
      <MePage
        title="관심 매물·단지"
        mobileTitle="관심"
        description={<FavoritesDescription />}
        mobileActions={<MobileBellLink />}
      >
        <FavoritesView />
      </MePage>
    </HydrationBoundary>
  );
}
