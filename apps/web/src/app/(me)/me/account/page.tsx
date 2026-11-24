import { AccountSettings } from '@/features/w-auth/components/account/AccountSettings';
import { AUTH_ROUTES } from '@/features/w-auth/routes';
import { MePage } from '@/features/w-me/components/MePage';
import { ME_ROUTES } from '@/features/w-me/routes';
import { requireUser } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

// Owned by the w-auth page group; lives in the my-page route group to share its chrome.
export const metadata = buildMetadata({
  title: '계정 설정',
  description: '로그인 계정 연결, 약관 동의 내역, 로그아웃과 회원 탈퇴를 관리하세요.',
  path: AUTH_ROUTES.account,
  noindex: true,
});

export default async function AccountSettingsPage() {
  await requireUser(AUTH_ROUTES.account);
  return (
    <MePage
      title="계정 설정"
      description="로그인에 쓰는 소셜 계정과 약관 동의 내역, 로그아웃을 관리해요."
      backHref={ME_ROUTES.profile}
      narrow
    >
      <AccountSettings />
    </MePage>
  );
}
