'use client';
import { Button, ErrorState, Modal, SkeletonText } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { TermsVersion } from '@/features/w-content/api/schemas';
import { authKeys, fetchTermsDocument, fetchTermsVersion, type TermsDocument } from '../../api';
import { CONSENT_COPY } from '../../lib/consents';
import styles from './signup.module.css';

/** What the modal needs to know before the full document is fetched. */
export type TermsModalDoc = Pick<TermsDocument, 'type' | 'isRequired'> &
  Partial<Pick<TermsDocument, 'version' | 'effectiveAt'>>;

export interface TermsModalProps<D extends TermsModalDoc = TermsModalDoc> {
  /** Document to show; null = closed. */
  doc: D | null;
  agreed?: boolean;
  onClose: () => void;
  /** "동의하기" in the footer (not used when `readOnly`). */
  onAgree?: (doc: D) => void;
  /** Viewing only (consent history): no agree button. */
  readOnly?: boolean;
  /**
   * Show exactly `doc.version` (GET /terms/:type?version=) instead of the current document —
   * the consent history must show the text the user actually agreed to, even after a new version.
   */
  exactVersion?: boolean;
}

/** Full text of one terms document (current, or one exact version), with its version and effective date. */
export function TermsModal<D extends TermsModalDoc>({
  doc,
  agreed = false,
  onClose,
  onAgree,
  readOnly,
  exactVersion,
}: TermsModalProps<D>) {
  const pinned = exactVersion && doc?.version ? doc.version : undefined;
  const query = useQuery({
    queryKey: !doc
      ? ['terms', 'document', 'none']
      : pinned
        ? authKeys.termsVersion(doc.type, pinned)
        : authKeys.termsDocument(doc.type),
    queryFn: ({ signal }): Promise<TermsVersion> =>
      pinned ? fetchTermsVersion(doc!.type, pinned, signal) : fetchTermsDocument(doc!.type, signal),
    enabled: doc !== null,
    staleTime: 5 * 60_000,
  });
  const full = query.data;
  // Prefer the metadata of the fetched document (the current one may be newer than the row).
  const version = full?.version ?? doc?.version;
  const effectiveAt = full?.effectiveAt ?? doc?.effectiveAt;
  return (
    <Modal
      open={doc !== null}
      onClose={onClose}
      size="md"
      title={doc ? CONSENT_COPY[doc.type].label : ''}
      footer={
        doc && (
          <>
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            {!readOnly && (
              <Button
                disabled={agreed || !full}
                onClick={() => {
                  onAgree?.(doc);
                  onClose();
                }}
              >
                {agreed ? '동의 완료' : '동의하기'}
              </Button>
            )}
          </>
        )
      }
    >
      {doc && (
        <>
          <p className={styles.termsMeta}>
            <span>{doc.isRequired ? '필수 동의' : '선택 동의'}</span>
            {version && (
              <>
                <span aria-hidden="true">·</span>
                <span className="num">버전 {version}</span>
              </>
            )}
            {effectiveAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="num">시행일 {formatDate(effectiveAt)}</span>
              </>
            )}
          </p>
          {query.isPending ? (
            <div className={styles.termsBody} aria-busy="true">
              <SkeletonText lines={8} />
            </div>
          ) : query.isError || !full?.content ? (
            <ErrorState
              compact
              title="약관을 불러오지 못했어요"
              description={query.isError ? errorMessage(query.error) : undefined}
              onRetry={() => void query.refetch()}
            />
          ) : (
            // Plain text from the admin, line breaks preserved; rendered as text (never as HTML).
            <div className={styles.termsBody} tabIndex={0} role="document" aria-label="약관 전문">
              {full.content}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
