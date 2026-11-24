'use client';
import { Button, ConfirmDialog, Icon, useToast } from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { logoutAll } from '../../api';
import { loginPath } from '../../lib/flow';
import styles from './account.module.css';

/** 로그아웃: this device (POST /auth/logout) or every device (POST /auth/logout-all, confirmed). */
export function SessionPanel() {
  const { logout } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmAll, setConfirmAll] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const all = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => {
      queryClient.clear();
      window.location.assign(`${loginPath()}?reason=logout`);
    },
    onError: (error) => {
      setConfirmAll(false);
      toast({ message: errorMessage(error), tone: 'error' });
    },
  });

  return (
    <section className={styles.card} aria-labelledby="auth-session-h">
      <header className={styles.cardHead}>
        <div>
          <h2 id="auth-session-h" className={styles.cardTitle}>
            로그인 관리
          </h2>
          <p className={styles.cardDesc}>공용 PC를 썼다면 사용 후 꼭 로그아웃해 주세요.</p>
        </div>
      </header>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowText}>
            <b>이 기기에서 로그아웃</b>
            <span>지금 쓰는 브라우저에서만 로그아웃해요.</span>
          </span>
          <Button
            variant="secondary"
            loading={leaving}
            iconLeft={<Icon name="logout" size={18} />}
            onClick={() => {
              setLeaving(true);
              void logout();
            }}
          >
            로그아웃
          </Button>
        </div>
        <div className={styles.row}>
          <span className={styles.rowText}>
            <b>모든 기기에서 로그아웃</b>
            <span>휴대폰, 다른 PC 등 로그인된 모든 곳에서 한 번에 로그아웃해요.</span>
          </span>
          <Button variant="secondary" onClick={() => setConfirmAll(true)}>
            모두 로그아웃
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={() => all.mutate()}
        title="모든 기기에서 로그아웃할까요?"
        description="이 기기를 포함해 로그인된 모든 곳에서 로그아웃돼요. 다시 쓰려면 간편 로그인을 한 번 더 해야 해요."
        confirmLabel="모두 로그아웃"
        loading={all.isPending || all.isSuccess}
      />
    </section>
  );
}
