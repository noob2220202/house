import { HydrationBoundary } from '@tanstack/react-query';
import { MePage } from '@/features/w-me/components/MePage';
import { RecentView } from '@/features/w-me/components/RecentView';
import { parsePageParam } from '@/features/w-me/lib/params';
import { ME_ROUTES } from '@/features/w-me/routes';
import { prefetchRecent, requireMe } from '@/features/w-me/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '최근 본 매물',
  description: '최근에 살펴본 매물을 이어서 확인하세요.',
  path: ME_ROUTES.recent,
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// `?page=` is read here only for the first render; pagination then changes the URL on the client.
export default async function RecentPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePageParam((await searchParams).page);
  const [, state] = await Promise.all([requireMe(ME_ROUTES.recent), prefetchRecent(page)]);
  return (
    <HydrationBoundary state={state}>
      <MePage
        title="최근 본 매물"
        description="살펴본 매물이 최근 순서로 모여요. 하트를 누르면 관심 매물에 담겨요."
        backHref={ME_ROUTES.overview}
      >
        <RecentView now={Date.now()} />
      </MePage>
    </HydrationBoundary>
  );
}
