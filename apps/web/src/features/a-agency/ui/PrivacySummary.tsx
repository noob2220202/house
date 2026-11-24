import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import styles from './ui.module.css';

export interface PrivacySummaryProps {
  id?: string;
  notice: { items: string; purpose: string; retention: string };
  /** What refusing blocks ("신청" / "합류"). */
  action?: string;
}

/**
 * Inline 개인정보 수집·이용 notice next to its own consent checkbox: items, purpose, retention and the
 * right to refuse (개인정보 보호법 제15조 제2항), plus a link to the full policy.
 */
export function PrivacySummary({ id, notice, action = '신청' }: PrivacySummaryProps) {
  return (
    <div id={id} className={styles.privacy}>
      <dl>
        <div>
          <dt>수집 항목</dt>
          <dd>{notice.items}</dd>
        </div>
        <div>
          <dt>이용 목적</dt>
          <dd>{notice.purpose}</dd>
        </div>
        <div>
          <dt>보유 기간</dt>
          <dd>{notice.retention}</dd>
        </div>
      </dl>
      <p>
        동의하지 않을 수 있지만, 이 경우 {action}할 수 없어요.{' '}
        <Link href={ROUTES.terms('privacy')} target="_blank" className="link">
          개인정보 처리방침<span className="sr-only"> (새 창)</span>
        </Link>
      </p>
    </div>
  );
}
