import { Button } from '@house/ui';
import Link from 'next/link';
import { AUTH_ROUTES } from '../../routes';
import styles from './account.module.css';

/** Entry to the withdrawal flow (/me/withdraw). Server-renderable. */
export function WithdrawEntry() {
  return (
    <section className={`${styles.card} ${styles.danger}`} aria-labelledby="auth-withdraw-h">
      <div className={styles.row}>
        <span className={styles.rowText}>
          <h2 id="auth-withdraw-h">회원 탈퇴</h2>
          <span>
            탈퇴하면 관심 매물, 요청 내역 등 모든 정보가 삭제되고 되돌릴 수 없어요. 탈퇴 전 안내를
            꼭 확인해 주세요.
          </span>
        </span>
        <Button href={AUTH_ROUTES.withdraw} linkAs={Link} variant="ghost">
          <span className={styles.dangerTitle}>탈퇴 안내 보기</span>
        </Button>
      </div>
    </section>
  );
}
