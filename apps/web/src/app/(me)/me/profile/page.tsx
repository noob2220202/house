import { HydrationBoundary } from '@tanstack/react-query';
import { MePage } from '@/features/w-me/components/MePage';
import { ProfileView } from '@/features/w-me/components/ProfileView';
import { ME_ROUTES } from '@/features/w-me/routes';
import { prefetchProfile, requireMe } from '@/features/w-me/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '내 정보',
  description: '닉네임, 연락처, 마케팅 수신 동의와 연결된 계정을 관리하세요.',
  path: ME_ROUTES.profile,
  noindex: true,
});

export default async function ProfilePage() {
  const [, state] = await Promise.all([requireMe(ME_ROUTES.profile), prefetchProfile()]);
  return (
    <HydrationBoundary state={state}>
      <MePage
        title="내 정보"
        description="닉네임과 연락처, 수신 동의, 연결된 계정을 관리해요."
        backHref={ME_ROUTES.overview}
        narrow
      >
        <ProfileView />
      </MePage>
    </HydrationBoundary>
  );
}
