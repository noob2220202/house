'use client';
import { VERIFICATION_METHOD_LABEL, VerificationMethod, type ListingStatus } from '@house/shared';
import { Button, ConfirmDialog, Input, Modal, cx } from '@house/ui';
import { useState } from 'react';
import { toKstDateString } from '@/lib/format';
import type { VerificationInput } from '../api/queries';
import type { AgencyListingItem } from '../api/schemas';
import { rowLabel } from '../lib/display';
import {
  STATUS_ACTION_LABEL,
  STATUS_CONFIRM_TITLE,
  STATUS_EFFECT,
  VERIFICATION_VALID_DAYS,
} from '../lib/status';
import styles from './list.module.css';

const METHODS: VerificationMethod[] = [
  VerificationMethod.SITE_VISIT,
  VerificationMethod.OWNER_CALL,
  VerificationMethod.OWNER_CONFIRMED,
  VerificationMethod.REGISTRY,
  VerificationMethod.DOCUMENT,
];

function TargetList({ rows }: { rows: readonly AgencyListingItem[] }) {
  return (
    <ul className={styles.dialogList} aria-label="선택한 매물">
      {rows.map((r) => (
        <li key={r.id}>{rowLabel(r)}</li>
      ))}
    </ul>
  );
}

export interface VerifyDialogProps {
  rows: readonly AgencyListingItem[];
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: VerificationInput) => void;
}

/** 실매물 확인 기록 for one or several listings (same method / date). */
export function VerifyDialog({ rows, open, loading, onClose, onSubmit }: VerifyDialogProps) {
  const today = toKstDateString();
  const [method, setMethod] = useState<VerificationMethod | ''>('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!method) return setError('확인 방법을 선택해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('확인한 날짜를 선택해 주세요.');
    if (date > today) return setError('확인일은 오늘 이후일 수 없어요.');
    setError(null);
    onSubmit({ method, verifiedAt: date, note: note.trim() || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={rows.length > 1 ? `실매물 확인 기록 · ${rows.length}건` : '실매물 확인 기록'}
      description="소유자(임대인)에게 거래 의사와 조건을 다시 확인한 뒤 기록해 주세요."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={submit} loading={loading}>
            확인 기록하기
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <TargetList rows={rows} />
        <div className={styles.dialogBody} style={{ gap: 8 }}>
          <span className={styles.fieldLabel} id="vd-method">
            확인 방법
          </span>
          <div className={styles.methods} role="radiogroup" aria-labelledby="vd-method">
            {METHODS.map((m) => (
              <label key={m} className={cx(styles.methodChip, method === m && styles.sel)}>
                <input
                  className="sr-only"
                  type="radio"
                  name="vd-method"
                  value={m}
                  checked={method === m}
                  onChange={() => {
                    setMethod(m);
                    setError(null);
                  }}
                />
                {VERIFICATION_METHOD_LABEL[m]}
              </label>
            ))}
          </div>
        </div>
        <Input
          label="확인일"
          type="date"
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          label="메모 (사무소 내부용)"
          maxLength={500}
          placeholder="예: 임대인과 통화, 가격 변동 없음"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p className={styles.dialogErr} role="alert">
            {error}
          </p>
        )}
        <p className={styles.dialogHint}>
          기록하면 다음 확인 기한이 {VERIFICATION_VALID_DAYS}일 뒤로 늘어나요. 거래가 끝났다면 확인
          대신 ‘거래완료 처리’를 해 주세요.
        </p>
      </div>
    </Modal>
  );
}

export interface StatusDialogProps {
  rows: readonly AgencyListingItem[];
  to: ListingStatus | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmation of a status change (single row or bulk) with its effect on the public site. */
export function StatusDialog({ rows, to, loading, onClose, onConfirm }: StatusDialogProps) {
  if (!to) return null;
  const first = rows[0];
  const subject = rows.length === 1 && first ? rowLabel(first) : `선택한 매물 ${rows.length}건`;
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      danger={to === 'CLOSED'}
      title={STATUS_CONFIRM_TITLE[to]}
      description={
        <>
          <b>{subject}</b>
          <br />
          {STATUS_EFFECT[to]}
        </>
      }
      confirmLabel={STATUS_ACTION_LABEL[to]}
    />
  );
}
