'use client';
import { Button, Icon } from '@house/ui';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { api } from '@/lib/api';
import { API_BASE_PATH } from '@/lib/api/config';
import { adminRoleLabel } from '@/lib/auth/types';
import { AdminRole } from '@house/shared';
import styles from './login.module.css';

const devAccountsSchema = z.object({
  password: z.string(),
  totpCode: z.string(),
  accounts: z.array(
    z.object({
      email: z.string(),
      role: z.enum(AdminRole),
      totpEnrolled: z.boolean(),
      locked: z.boolean().default(false),
    }),
  ),
});
type DevAccounts = z.infer<typeof devAccountsSchema>;

const QUICK = [
  { as: 'super', label: '최고관리자' },
  { as: 'admin', label: '관리자' },
  { as: 'operator', label: '운영자' },
] as const;

export interface DevLoginPanelProps {
  returnTo: string;
  onPick: (credentials: { email: string; password: string }) => void;
}

/**
 * MOCK MODE ONLY. Quick role sign-in (foundation's dev-login) and the fictional test accounts of the
 * mock backend, fetched from a mock-only endpoint so nothing of this ships in a production bundle.
 */
export function DevLoginPanel({ returnTo, onPick }: DevLoginPanelProps) {
  const [data, setData] = useState<DevAccounts | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .get('/admin/auth/dev-accounts', { schema: devAccountsSchema, signal: ctrl.signal })
      .then(setData)
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);
  return (
    <details className={styles.dev}>
      <summary>
        <Icon name="key" size={18} />
        개발용 목(mock) 로그인
        <Icon name="chevron-down" size={16} />
      </summary>
      <div className={styles.devBody}>
        <p>
          운영 환경에는 노출되지 않습니다. 역할별로 바로 들어가거나, 테스트 계정으로 전체 흐름을
          확인하세요.
        </p>
        <div className={styles.devRow}>
          {QUICK.map((q) => (
            <Button
              key={q.as}
              size="sm"
              variant="secondary"
              href={`${API_BASE_PATH}/admin/auth/dev-login?as=${q.as}&returnTo=${encodeURIComponent(returnTo)}`}
              iconLeft={<Icon name="shield" size={16} />}
            >
              {q.label}로 바로 들어가기
            </Button>
          ))}
        </div>
        {data && (
          <>
            <ul className={styles.devAccounts}>
              {data.accounts.map((a) => (
                <li key={a.email}>
                  <span>
                    <code>{a.email}</code>
                    <small>
                      {adminRoleLabel(a.role)}
                      {a.locked ? ' · 잠긴 계정' : a.totpEnrolled ? '' : ' · 인증 앱 미등록'}
                    </small>
                  </span>
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => onPick({ email: a.email, password: data.password })}
                  >
                    입력
                  </Button>
                </li>
              ))}
            </ul>
            <p className={styles.devMeta}>
              비밀번호 <code>{data.password}</code> · 인증 코드 <code>{data.totpCode}</code> (또는
              인증 앱의 실제 코드)
            </p>
          </>
        )}
      </div>
    </details>
  );
}
