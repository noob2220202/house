import { WithdrawForm } from '@/features/w-auth/components/withdraw/WithdrawForm';
import { AUTH_ROUTES } from '@/features/w-auth/routes';
import { MePage } from '@/features/w-me/components/MePage';
import { requireUser } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

// Owned by the w-auth page group; lives in the my-page route group to share its chrome.
export const metadata = buildMetadata({
  title: '회원 탈퇴',
  description: '탈퇴 전 안내를 확인하고 회원 탈퇴를 진행하세요.',
  path: AUTH_ROUTES.withdraw,
  noindex: true,
});

export default async function WithdrawPage() {
  const user = await requireUser(AUTH_ROUTES.withdraw);
  return (
    <MePage
      title="회원 탈퇴"
      description="탈퇴하면 되돌릴 수 없어요. 안내를 확인한 뒤 진행해 주세요."
      backHref={AUTH_ROUTES.account}
      narrow
    >
      <WithdrawForm user={{ nickname: user.nickname, role: user.role, email: user.email }} />
    </MePage>
  );
}
