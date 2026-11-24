'use client';
import type { AgencyDocumentType } from '@house/shared';
import { Dropzone, Icon, IconButton, Spinner, cx } from '@house/ui';
import { formatDateShort } from '@/lib/format';
import { privateMediaUrl } from '../api/queries';
import type { AgencyDocument } from '../api/schemas';
import { DOCUMENT_ACCEPT, DOCUMENT_SLOTS, type DocumentSlot } from '../lib/application';
import { FileButton } from '../ui/FileButton';
import styles from './Apply.module.css';
import type { PendingDocuments } from './useDocumentUploads';

export interface DocumentSlotsProps {
  /** Documents already attached to the agency (latest per type). */
  existing?: Partial<Record<AgencyDocumentType, AgencyDocument>>;
  /** Files picked in this session (uploading / uploaded / failed). */
  pending: PendingDocuments;
  onPick: (type: AgencyDocumentType, file: File) => void;
  onRemove?: (type: AgencyDocumentType) => void;
  /** Read-only: no pickers (staff view, suspended office). */
  readOnly?: boolean;
  /**
   * Approved office: only renewable slots (손해배상책임 보증서류) accept a file, labelled
   * "갱신본 제출"; the others are read-only.
   */
  renewOnly?: boolean;
  /** Types to flag as missing (after a submit attempt). */
  missing?: readonly AgencyDocumentType[];
}

function SlotBody({
  slot,
  existing,
  pending,
  onPick,
  onRemove,
  editable,
  renew,
  flagged,
}: {
  slot: DocumentSlot;
  existing?: AgencyDocument;
  pending?: PendingDocuments[AgencyDocumentType];
  onPick: (file: File) => void;
  onRemove?: () => void;
  editable: boolean;
  /** The slot takes a renewed copy (approved office) rather than a correction. */
  renew: boolean;
  flagged: boolean;
}) {
  const replaceLabel = renew ? '갱신본 제출' : '교체';
  if (pending) {
    return (
      <div className={cx(styles.file, pending.status === 'error' && styles.fileError)}>
        <span className={styles.fileIcon}>
          {pending.status === 'uploading' ? (
            <Spinner size={18} label="업로드 중" />
          ) : (
            <Icon name={pending.status === 'error' ? 'alert' : 'document'} size={20} />
          )}
        </span>
        <span className={styles.fileText}>
          <span className={styles.fileName}>{pending.fileName}</span>
          <span className={styles.fileMeta} role={pending.status === 'error' ? 'alert' : 'status'}>
            {pending.status === 'uploading'
              ? '업로드 중…'
              : pending.status === 'error'
                ? pending.error
                : '업로드 완료 · 제출 대기'}
          </span>
        </span>
        {pending.status !== 'uploading' && (
          <FileButton
            variant="link"
            label={`${slot.label} 파일 ${pending.status === 'error' ? '다시 선택' : '교체'}`}
            accept={DOCUMENT_ACCEPT}
            onFile={onPick}
          >
            {pending.status === 'error' ? '다시 선택' : '교체'}
          </FileButton>
        )}
        {onRemove && (
          <IconButton
            label={`${slot.label} 파일 삭제`}
            size={36}
            variant="plain"
            onClick={onRemove}
          >
            <Icon name="close" size={18} />
          </IconButton>
        )}
      </div>
    );
  }
  if (existing) {
    return (
      <div className={styles.file}>
        <span className={cx(styles.fileIcon, styles.fileDone)}>
          <Icon name="check-circle" size={20} />
        </span>
        <span className={styles.fileText}>
          <span className={styles.fileName}>{existing.fileName || slot.label}</span>
          <span className={styles.fileMeta}>제출 완료 · {formatDateShort(existing.createdAt)}</span>
        </span>
        <a
          className={styles.fileLink}
          href={privateMediaUrl(existing.mediaId)}
          target="_blank"
          rel="noopener noreferrer"
        >
          보기<span className="sr-only"> — {slot.label} (새 창)</span>
        </a>
        {editable && (
          <FileButton
            variant="link"
            label={`${slot.label} ${renew ? '갱신본 제출' : '파일 교체'}`}
            accept={DOCUMENT_ACCEPT}
            onFile={onPick}
          >
            {replaceLabel}
          </FileButton>
        )}
      </div>
    );
  }
  if (!editable) {
    return <p className={styles.fileNone}>제출한 파일이 없어요</p>;
  }
  return (
    <Dropzone
      className={styles.drop}
      label={`${slot.label} 파일 선택`}
      accept={DOCUMENT_ACCEPT}
      onFiles={(files) => {
        const file = files[0];
        if (file) onPick(file);
      }}
      title={
        <>
          파일을 끌어다 놓거나 <b>클릭해서 선택</b>
        </>
      }
      hint="PDF · JPG · PNG, 10MB 이하"
      error={flagged ? `${slot.label}을(를) 올려 주세요.` : undefined}
    />
  );
}

/** The application's document slots (등록증, 사업자등록증, 보증서류, 자격증). */
export function DocumentSlots({
  existing = {},
  pending,
  onPick,
  onRemove,
  readOnly,
  renewOnly,
  missing = [],
}: DocumentSlotsProps) {
  return (
    <ul className={styles.slots}>
      {DOCUMENT_SLOTS.map((slot) => {
        const editable = !readOnly && (!renewOnly || !!slot.renewable);
        return (
          <li key={slot.type} className={styles.slot}>
            <p className={styles.slotHead}>
              <span className={styles.slotLabel}>{slot.label}</span>
              <span
                className={cx(
                  styles.req,
                  !slot.required && (slot.recommended ? styles.rec : styles.opt),
                )}
              >
                {slot.required ? '필수' : slot.recommended ? '권장' : '선택'}
              </span>
            </p>
            <p className={styles.slotHint}>
              {renewOnly && slot.renewable && !readOnly
                ? '공제증서나 보증보험을 갱신하면 새 증서를 올려 주세요. 만료되면 매물 노출이 제한될 수 있어요.'
                : slot.hint}
            </p>
            <SlotBody
              slot={slot}
              existing={existing[slot.type]}
              pending={pending[slot.type]}
              onPick={(file) => onPick(slot.type, file)}
              onRemove={onRemove ? () => onRemove(slot.type) : undefined}
              editable={editable}
              renew={!!renewOnly}
              flagged={missing.includes(slot.type)}
            />
          </li>
        );
      })}
    </ul>
  );
}
