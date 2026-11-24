'use client';
import { Switch, useToast } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useUpdateProfile } from '../api';
import { marketingConsentCaption } from '../lib/profile';
import type { Profile } from '../schemas';
import styles from './ProfileView.module.css';

/**
 * 마케팅 정보 수신 동의 switch. Saved immediately (PATCH /me/profile) and the result is confirmed
 * with the date and time of the change, which also stays visible under the switch.
 */
export function MarketingConsentCard({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const update = useUpdateProfile();
  // Show the requested state while the request is in flight; fall back to the saved one.
  const checked =
    update.isPending && update.variables?.marketingOptIn !== undefined
      ? update.variables.marketingOptIn
      : profile.marketingOptIn;

  const onChange = (next: boolean) => {
    // One change at a time. The switch is NOT disabled meanwhile — a disabled input would drop the
    // keyboard focus to <body> — it just ignores input until the answer is back (aria-busy).
    if (update.isPending) return;
    update.mutate(
      { marketingOptIn: next },
      {
        onSuccess: (saved) =>
          toast({
            message: `${formatDateTime(saved.marketingOptInAt ?? new Date())} 마케팅 정보 수신${
              saved.marketingOptIn ? '에 동의' : '을 거부'
            }하셨어요.`,
            duration: 6000,
          }),
        onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
      },
    );
  };

  return (
    <section className={styles.card} aria-labelledby="me-marketing-h">
      <div className={styles.consent}>
        <div className={styles.consentText}>
          <h2 id="me-marketing-h" className={styles.cardTitle}>
            마케팅 정보 수신 동의 <span className={styles.optional}>선택</span>
          </h2>
          <p id="me-marketing-d" className={styles.cardDesc}>
            관심 지역의 새 매물, 분양 소식, 이벤트를 알림과 이메일로 받아요. 동의하지 않아도
            서비스는 그대로 이용할 수 있고, 거래·신고 처리 같은 필수 안내는 계속 보내 드려요.
          </p>
        </div>
        <Switch
          className={styles.consentSwitch}
          checked={checked}
          aria-busy={update.isPending || undefined}
          aria-labelledby="me-marketing-h"
          aria-describedby="me-marketing-d me-marketing-at"
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      <p id="me-marketing-at" className={styles.consentAt}>
        <span className={profile.marketingOptIn ? styles.consentOn : styles.consentOff}>
          {marketingConsentCaption(profile.marketingOptIn, profile.marketingOptInAt)}
        </span>
        <Link href={ROUTES.terms('privacy')}>개인정보처리방침</Link>
      </p>
    </section>
  );
}
