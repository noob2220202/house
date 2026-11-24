import { HydrationBoundary } from '@tanstack/react-query';
import { MePage } from '@/features/w-me/components/MePage';
import { MobileOverviewActions } from '@/features/w-me/components/MobileBellLink';
import { OverviewView } from '@/features/w-me/components/OverviewView';
import { ME_ROUTES } from '@/features/w-me/routes';
import { prefetchOverview, requireMe } from '@/features/w-me/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '마이페이지',
  description: '관심 매물과 단지, 최근 본 매물, 알림을 한곳에서 확인하세요.',
  path: ME_ROUTES.overview,
  noindex: true,
});

export default async function MeOverviewPage() {
  // Guard and data in parallel: the HTML is sent with its lists already filled in.
  const [user, state] = await Promise.all([requireMe(ME_ROUTES.overview), prefetchOverview()]);
  return (
    <HydrationBoundary state={state}>
      <MePage
        title="마이페이지"
        mobileTitle="MY"
        hideHeading
        mobileActions={<MobileOverviewActions />}
      >
        <OverviewView user={user} now={Date.now()} />
      </MePage>
    </HydrationBoundary>
  );
}
