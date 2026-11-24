import { HydrationBoundary } from '@tanstack/react-query';
import { MePage } from '@/features/w-me/components/MePage';
import { NotificationsView } from '@/features/w-me/components/NotificationsView';
import { ME_ROUTES } from '@/features/w-me/routes';
import { prefetchNotifications, requireMe } from '@/features/w-me/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '알림',
  description: '제안 도착, 신고 처리 결과 등 내 알림을 확인하세요.',
  path: ME_ROUTES.notifications,
  noindex: true,
});

export default async function NotificationsPage() {
  const [, state] = await Promise.all([
    requireMe(ME_ROUTES.notifications),
    prefetchNotifications(),
  ]);
  return (
    <HydrationBoundary state={state}>
      <MePage
        title="알림"
        description="제안 도착, 신고 처리 결과 같은 새 소식을 여기에서 알려 드려요."
        backHref={ME_ROUTES.overview}
      >
        <NotificationsView now={Date.now()} />
      </MePage>
    </HydrationBoundary>
  );
}
