'use client';
import { Badge, Button, EmptyState, ErrorState, Icon, Skeleton } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ME_ROUTES } from '@/features/w-me/routes';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { authKeys, fetchConsents, type ConsentRecord } from '../../api';
import { CONSENT_COPY, TERMS_ORDER } from '../../lib/consents';
import { TermsModal, type TermsModalDoc } from '../signup/TermsModal';
import styles from './account.module.css';

const rank = (record: ConsentRecord) => {
  const i = TERMS_ORDER.indexOf(record.type);
  return i === -1 ? TERMS_ORDER.length : i;
};

/**
 * 약관 동의 내역 (GET /me/consents): the member's latest decision for every current account
 * document, its version and date. A required document whose new version is not agreed yet shows
 * "동의하기", which opens the re-consent prompt.
 */
export function ConsentHistoryPanel() {
  const { user, requestReconsent } = useSession();
  const pendingTypes = user?.pendingRequiredTerms ?? [];
  const [viewing, setViewing] = useState<TermsModalDoc | null>(null);
  const query = useQuery({
    queryKey: authKeys.consents(),
    queryFn: ({ signal }) => fetchConsents(signal),
  });
  const records = [...(query.data ?? [])].sort((a, b) => rank(a) - rank(b));

  return (
    <section className={styles.card} aria-labelledby="auth-consents-h">
      <header className={styles.cardHead}>
        <div>
          <h2 id="auth-consents-h" className={styles.cardTitle}>
            약관 동의 내역
          </h2>
          <p className={styles.cardDesc}>
            지금 시행 중인 약관에 대한 동의 여부와 버전이에요. 마케팅 수신 동의는{' '}
            <Link className="link" href={ME_ROUTES.profile}>
              내 정보
            </Link>
            에서 바꿀 수 있어요.
          </p>
        </div>
      </header>
      {query.isPending ? (
        <ul className={styles.consents} aria-busy="true" aria-label="약관 동의 내역을 불러오는 중">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className={styles.consent}>
              <span className={styles.consentText}>
                <Skeleton width={`${44 + i * 6}%`} height={16} />
                <Skeleton width={120} height={12} />
              </span>
              <Skeleton width={44} height={22} radius={999} />
            </li>
          ))}
        </ul>
      ) : query.isError ? (
        <ErrorState
          compact
          title="동의 내역을 불러오지 못했어요"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : records.length === 0 ? (
        <EmptyState
          compact
          icon="shield"
          title="시행 중인 약관이 없어요"
          description="운영자가 약관을 게시하면 동의 여부와 버전이 여기에 표시돼요."
        />
      ) : (
        <ul className={styles.consents}>
          {records.map((record) => {
            const label = CONSENT_COPY[record.type]?.label ?? record.title;
            const missing =
              record.isRequired && (!record.agreed || pendingTypes.includes(record.type));
            return (
              <li key={record.termsDocumentId} className={styles.consent}>
                <span className={styles.consentText}>
                  <b>
                    {label}
                    <small>v{record.version}</small>
                  </b>
                  <span>
                    {record.isRequired ? '필수' : '선택'} ·{' '}
                    {record.decidedAt ? (
                      <>
                        <span className="num">{formatDate(record.decidedAt)}</span>{' '}
                        {record.agreed ? '동의' : '동의 안 함'}
                      </>
                    ) : (
                      '아직 동의하지 않았어요'
                    )}
                  </span>
                </span>
                {missing ? (
                  <Button size="sm" variant="soft" onClick={requestReconsent}>
                    동의하기
                  </Button>
                ) : record.agreed ? (
                  <Badge tone="success">동의</Badge>
                ) : (
                  <Badge>미동의</Badge>
                )}
                <button
                  type="button"
                  className={styles.viewBtn}
                  aria-label={`${label} 전문 보기`}
                  onClick={() =>
                    setViewing({
                      type: record.type,
                      isRequired: record.isRequired,
                      version: record.version,
                    })
                  }
                >
                  보기
                  <Icon name="chevron-right" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* Shows the version the user agreed to, not the current one. */}
      <TermsModal doc={viewing} agreed readOnly exactVersion onClose={() => setViewing(null)} />
    </section>
  );
}
