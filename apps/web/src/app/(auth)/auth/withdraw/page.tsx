import { AuthTopBar } from '@/features/w-auth/components/shell/AuthShell';
import { WithdrawForm } from '@/features/w-auth/components/withdraw/WithdrawForm';
import styles from '@/features/w-auth/components/withdraw/withdraw.module.css';
import { AUTH_ROUTES } from '@/features/w-auth/routes';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '회원 탈퇴',
  path: AUTH_ROUTES.suspendedWithdraw,
  noindex: true,
});

/**
 * 회원 탈퇴 of a suspended member (개인정보 보호법 제36·37조: deletion stays possible while
 * suspended). Reached from `/login?error=AUTH_ACCOUNT_SUSPENDED&withdrawable=1`; there is no
 * session — POST /auth/withdraw is authenticated by the 10-minute single-use ticket cookie the
 * refused login set (scoped to /api/v1/auth/withdraw, so this page cannot check it up front).
 */
export default function SuspendedWithdrawPage() {
  return (
    <>
      <AuthTopBar />
      <div className={styles.page}>
        <div className={styles.pageIn}>
          <header className={styles.pageHead}>
            <h1 className="t-h1">회원 탈퇴</h1>
            <p className="t-sm">
              이용이 정지된 계정도 탈퇴할 수 있어요. 안내를 확인한 뒤 진행해 주세요.
            </p>
          </header>
          <WithdrawForm mode="suspended" />
        </div>
      </div>
    </>
  );
}
