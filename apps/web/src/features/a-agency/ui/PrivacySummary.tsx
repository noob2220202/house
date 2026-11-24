import { ErrorState, SkeletonText } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { errorMessage, type ActionTermsDocument } from '@/lib/api';
import { formatDate } from '@/lib/format';
import styles from './ui.module.css';

export interface PrivacySummaryProps {
  id?: string;
  /**
   * The published purpose document (GET /terms/:type via `useActionTerms`): the text shown here is
   * the one whose version the submission records.
   */
  terms: {
    data?: readonly ActionTermsDocument[];
    isError: boolean;
    error?: unknown;
    refetch: () => unknown;
  };
  /** What refusing blocks ("신청" / "합류"). */
  action?: string;
}

/**
 * Inline 개인정보 수집·이용 notice next to its own consent checkbox: the published document (items,
 * purpose, retention, the right to refuse — 개인정보 보호법 제15조 제2항) with its version, plus a
 * link to the full policy.
 */
export function PrivacySummary({ id, terms, action = '신청' }: PrivacySummaryProps) {
  const doc = terms.data?.[0];
  if (!doc) {
    return terms.isError ? (
      <div id={id} className={styles.privacy}>
        <ErrorState
          compact
          title="동의 내용을 불러오지 못했어요"
          description={`${errorMessage(terms.error)} 내용을 확인한 뒤에 ${action}할 수 있어요.`}
          onRetry={() => void terms.refetch()}
        />
      </div>
    ) : (
      <div id={id} className={styles.privacy} aria-busy="true" aria-label="동의 내용을 불러오는 중">
        <SkeletonText lines={3} />
      </div>
    );
  }
  return (
    <div id={id} className={styles.privacy}>
      <p className={styles.privacyMeta}>
        <b>{doc.title}</b>{' '}
        <span className="num">
          버전 {doc.version}
          {doc.effectiveAt ? ` · 시행일 ${formatDate(doc.effectiveAt)}` : ''}
        </span>
      </p>
      {/* Plain text from the admin, line breaks preserved; rendered as text (never as HTML). */}
      <div className={styles.privacyText}>{doc.content}</div>
      <p>
        동의하지 않을 수 있지만, 이 경우 {action}할 수 없어요.{' '}
        <Link href={ROUTES.terms('privacy')} target="_blank" className="link">
          개인정보 처리방침<span className="sr-only"> (새 창)</span>
        </Link>
      </p>
    </div>
  );
}
