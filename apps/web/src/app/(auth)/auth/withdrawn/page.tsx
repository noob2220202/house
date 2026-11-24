import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import styles from '@/features/w-auth/components/callback/callback.module.css';
import { AuthTopBar } from '@/features/w-auth/components/shell/AuthShell';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '탈퇴 완료',
  path: '/auth/withdrawn',
  noindex: true,
});

/** Farewell page after POST /me/withdraw (the session is already gone). */
export default function WithdrawnPage() {
  return (
    <>
      <AuthTopBar />
      <div className={styles.wrap}>
        <div className={styles.card}>
          <span className={`${styles.icon} ${styles.iconOk}`}>
            <Icon name="check" size={30} strokeWidth={2.5} />
          </span>
          <h1 className={styles.title}>탈퇴가 완료됐어요</h1>
          <p className={styles.desc}>
            그동안 {BRAND.name} 서비스를 이용해 주셔서 고맙습니다. 모든 기기에서 로그아웃됐고,
            개인정보는 개인정보처리방침에 따라 안전하게 파기돼요.
          </p>
          <ul className={styles.list}>
            <li>
              <Icon name="info" size={16} />
              로그인 없이도 매물 검색과 지도는 계속 이용할 수 있어요.
            </li>
            <li>
              <Icon name="refresh" size={16} />
              다시 이용하고 싶을 땐 간편 로그인으로 새로 가입하면 돼요.
            </li>
          </ul>
          <div className={styles.actions}>
            <Button href={ROUTES.home} linkAs={Link} size="lg">
              홈으로
            </Button>
            <Button href={ROUTES.terms('privacy')} linkAs={Link} size="lg" variant="secondary">
              개인정보처리방침
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
