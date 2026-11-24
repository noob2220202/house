'use client';
import type { TermsType } from '@house/shared';
import {
  Button,
  Callout,
  Checkbox,
  ErrorState,
  Icon,
  Modal,
  Skeleton,
  SkeletonText,
  cx,
} from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  authKeys,
  fetchTerms,
  fetchTermsDocument,
  submitConsents,
  type TermsDocument,
} from '../../api';
import { CONSENT_COPY, buildReconsentPayload, sortTerms } from '../../lib/consents';
import signup from '../signup/signup.module.css';
import styles from './reconsent.module.css';

export interface ReconsentDialogProps {
  /** Extra class on the dialog element (the session provider marks it). */
  className?: string;
  open: boolean;
  /** `pendingRequiredTerms` of the session: required types whose current version is not agreed. */
  pendingTypes: readonly TermsType[];
  /** "나중에 할게요" / Esc. Reading and 회원 탈퇴 stay possible without agreeing. */
  onClose: () => void;
  /** After POST /me/consents succeeded (refresh the session). */
  onAgreed: () => Promise<void> | void;
}

/**
 * 약관 재동의: a new version of a required document took effect, and the backend refuses the
 * member's state-changing requests (403 `AUTH_TERMS_REQUIRED`) until they agree via
 * POST /me/consents. Lists exactly the pending documents with their new version; each can be read
 * in place (no second modal on top).
 */
export function ReconsentDialog({
  open,
  pendingTypes,
  onClose,
  onAgreed,
  className,
}: ReconsentDialogProps) {
  const queryClient = useQueryClient();
  const terms = useQuery({
    queryKey: authKeys.terms(),
    queryFn: ({ signal }) => fetchTerms(signal),
    enabled: open,
    staleTime: 60_000,
  });
  const docs = sortTerms(
    (terms.data ?? []).filter((d) => d.isRequired && pendingTypes.includes(d.type)),
  );
  const [checked, setChecked] = useState<Partial<Record<TermsType, boolean>>>({});
  const [viewing, setViewing] = useState<TermsDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allChecked = docs.length > 0 && docs.every((d) => checked[d.type]);

  const close = () => {
    if (saving) return;
    setViewing(null);
    setError(null);
    onClose();
  };

  const agree = async () => {
    if (!allChecked) return;
    setSaving(true);
    setError(null);
    try {
      const records = await submitConsents(buildReconsentPayload(docs));
      queryClient.setQueryData(authKeys.consents(), records);
      await onAgreed();
      setChecked({});
    } catch (e) {
      if (e instanceof ApiError && e.code === 'AUTH_TERMS_INVALID') {
        // Another version took effect meanwhile: show the new list and ask again.
        setChecked({});
        setError('약관이 방금 다시 바뀌었어요. 바뀐 내용을 확인하고 다시 동의해 주세요.');
        void queryClient.invalidateQueries({ queryKey: authKeys.terms() });
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      className={className}
      title={viewing ? CONSENT_COPY[viewing.type].label : '바뀐 약관을 확인해 주세요'}
      footer={
        viewing ? (
          <Button
            onClick={() => {
              setChecked((prev) => ({ ...prev, [viewing.type]: true }));
              setViewing(null);
            }}
          >
            {checked[viewing.type] ? '확인' : '동의하기'}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              나중에 할게요
            </Button>
            <Button onClick={() => void agree()} loading={saving} disabled={!allChecked}>
              동의하고 계속하기
            </Button>
          </>
        )
      }
    >
      {viewing ? (
        <TermsReader doc={viewing} onBack={() => setViewing(null)} />
      ) : (
        <>
          <p className={styles.intro}>
            필수 약관이 새 버전으로 바뀌었어요. 동의하면 관심 등록, 요청 작성 같은 기능을 계속 쓸 수
            있어요. 동의하지 않아도 매물 보기와 내 정보 확인, 회원 탈퇴는 할 수 있어요.
          </p>
          {terms.isPending ? (
            <div className={cx(signup.agreeList, styles.list)} aria-busy="true">
              {pendingTypes.map((type) => (
                <div key={type} className={signup.skRow}>
                  <Skeleton width={22} height={22} radius={6} />
                  <Skeleton width="56%" height={16} />
                </div>
              ))}
            </div>
          ) : terms.isError ? (
            <ErrorState
              compact
              title="약관을 불러오지 못했어요"
              description={errorMessage(terms.error)}
              onRetry={() => void terms.refetch()}
            />
          ) : (
            <div
              className={cx(signup.agreeList, styles.list)}
              role="group"
              aria-label="다시 동의할 약관"
            >
              {docs.map((doc) => {
                const copy = CONSENT_COPY[doc.type];
                return (
                  <div key={doc.id} className={signup.agreeRow}>
                    <Checkbox
                      className={signup.agreeCheck}
                      checked={checked[doc.type] === true}
                      required
                      disabled={saving}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [doc.type]: e.target.checked }))
                      }
                    >
                      <span className={signup.agreeT}>
                        <span className={signup.req}>[필수]</span> {copy.label}
                        <span className={signup.ver}>v{doc.version}</span>
                        <small>{formatDate(doc.effectiveAt)}부터 시행</small>
                      </span>
                    </Checkbox>
                    <button
                      type="button"
                      className={signup.view}
                      aria-label={`${copy.label} 전문 보기`}
                      onClick={() => setViewing(doc)}
                    >
                      보기
                      <Icon name="chevron-right" size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {error && (
            <Callout tone="danger" size="sm" live className={styles.error}>
              {error}
            </Callout>
          )}
        </>
      )}
    </Modal>
  );
}

/** Full text of the current version, read inside the prompt. */
function TermsReader({ doc, onBack }: { doc: TermsDocument; onBack: () => void }) {
  const query = useQuery({
    queryKey: authKeys.termsDocument(doc.type),
    queryFn: ({ signal }) => fetchTermsDocument(doc.type, signal),
    staleTime: 5 * 60_000,
  });
  return (
    <>
      <button type="button" className={styles.back} onClick={onBack}>
        <Icon name="chevron-left" size={16} />
        목록으로
      </button>
      <p className={signup.termsMeta}>
        <span>필수 동의</span>
        <span aria-hidden="true">·</span>
        <span className="num">버전 {query.data?.version ?? doc.version}</span>
        <span aria-hidden="true">·</span>
        <span className="num">시행일 {formatDate(query.data?.effectiveAt ?? doc.effectiveAt)}</span>
      </p>
      {query.isPending ? (
        <div className={signup.termsBody} aria-busy="true">
          <SkeletonText lines={8} />
        </div>
      ) : query.isError || !query.data.content ? (
        <ErrorState
          compact
          title="약관을 불러오지 못했어요"
          description={query.isError ? errorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
        />
      ) : (
        // Plain text from the admin, line breaks preserved; rendered as text (never as HTML).
        <div className={signup.termsBody} tabIndex={0} role="document" aria-label="약관 전문">
          {query.data.content}
        </div>
      )}
    </>
  );
}
