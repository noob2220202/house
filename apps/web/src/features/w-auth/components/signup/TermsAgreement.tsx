'use client';
import type { TermsType } from '@house/shared';
import { Checkbox, ErrorState, Icon, Skeleton } from '@house/ui';
import { useState } from 'react';
import type { TermsDocument } from '../../api';
import {
  CONSENT_COPY,
  agreeAllState,
  countTerms,
  setAll,
  type ConsentState,
} from '../../lib/consents';
import { TermsModal } from './TermsModal';
import styles from './signup.module.css';

export interface TermsAgreementProps {
  /** Current documents in display order; undefined while loading. */
  docs: TermsDocument[] | undefined;
  loading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  /** Validation message shown under the list (missing required consent). */
  error?: string | null;
  disabled?: boolean;
}

/** id of the checkbox of one terms type (used to focus the first missing required consent). */
export const consentInputId = (type: TermsType) => `consent-${type.toLowerCase()}`;

/** 약관 동의 block: 전체 동의 + one row per current terms document with its version and 보기. */
export function TermsAgreement({
  docs,
  loading,
  loadError,
  onRetry,
  value,
  onChange,
  error,
  disabled,
}: TermsAgreementProps) {
  const [viewing, setViewing] = useState<TermsDocument | null>(null);

  if (loadError) {
    return (
      <ErrorState
        compact
        title="약관을 불러오지 못했어요"
        description={loadError}
        onRetry={onRetry}
      />
    );
  }
  if (loading || !docs) {
    return (
      <div aria-busy="true" aria-label="약관을 불러오는 중">
        <Skeleton height={68} radius={14} />
        <div className={styles.agreeList} style={{ marginTop: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skRow}>
              <Skeleton width={22} height={22} radius={6} />
              <Skeleton width={`${52 - i * 6}%`} height={16} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const all = agreeAllState(docs, value);
  const { optional } = countTerms(docs);
  return (
    <>
      <div className={styles.agreeAll}>
        <Checkbox
          checked={all === 'all'}
          // Native "mixed" state (aria-checked is ignored on a real checkbox).
          ref={(el) => {
            if (el) el.indeterminate = all === 'some';
          }}
          disabled={disabled}
          onChange={(e) => onChange(setAll(docs, e.target.checked))}
        >
          <span className={styles.agreeT}>
            <b>전체 동의</b>
            <small>
              {optional > 0
                ? '선택 항목인 마케팅 정보 수신을 포함해 모두 동의해요'
                : '아래 약관에 모두 동의해요'}
            </small>
          </span>
        </Checkbox>
      </div>
      <div className={styles.agreeList} role="group" aria-label="약관별 동의">
        {docs.map((doc) => {
          const copy = CONSENT_COPY[doc.type];
          return (
            <div key={doc.id} className={styles.agreeRow}>
              <Checkbox
                id={consentInputId(doc.type)}
                className={styles.agreeCheck}
                checked={value[doc.type] === true}
                required={doc.isRequired}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [doc.type]: e.target.checked })}
              >
                <span className={styles.agreeT}>
                  <span className={doc.isRequired ? styles.req : styles.opt}>
                    [{doc.isRequired ? '필수' : '선택'}]
                  </span>{' '}
                  {copy.label}
                  <span className={styles.ver}>v{doc.version}</span>
                  {copy.hint && <small>{copy.hint}</small>}
                </span>
              </Checkbox>
              <button
                type="button"
                className={styles.view}
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
      {error && (
        <p className={styles.agreeError} role="alert">
          <Icon name="info" size={16} />
          {error}
        </p>
      )}
      <TermsModal
        doc={viewing}
        agreed={viewing ? value[viewing.type] === true : false}
        onClose={() => setViewing(null)}
        onAgree={(doc) => onChange({ ...value, [doc.type]: true })}
      />
    </>
  );
}
