'use client';
import { Button, Chip, Modal, Textarea } from '@house/ui';
import { useEffect, useId, useState, type ReactNode } from 'react';
import s from './ui.module.css';

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** What the action applies to, shown in a grey well ("연향 센트럴 108동 · 전세 2억 4,000"). */
  target?: { title: ReactNode; sub?: ReactNode };
  /** Label of the reason textarea. */
  reasonLabel?: string;
  placeholder?: string;
  /** One-tap reason texts; tapping one fills the textarea. */
  presets?: readonly string[];
  /** Require a reason (default true) of at least `minLength` characters (default 5). */
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  help?: ReactNode;
  confirmLabel: string;
  /** Danger styling for destructive decisions (반려 · 정지 · 숨김). */
  danger?: boolean;
  /** Extra controls above the reason (e.g. the resolution choice of a report). */
  children?: ReactNode;
  /** Blocks the confirm button (e.g. extra controls incomplete). */
  confirmDisabled?: boolean;
  loading?: boolean;
  /** Server error to show inside the dialog. */
  error?: string | null;
  onConfirm: (reason: string) => void;
}

/**
 * Decision dialog with a reason: every moderation action that affects a member or an office
 * records why (shown to the affected party and kept in the audit log).
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  target,
  reasonLabel = '사유',
  placeholder = '처리 사유를 입력해 주세요.',
  presets,
  required = true,
  minLength = 5,
  maxLength = 500,
  help,
  confirmLabel,
  danger,
  children,
  confirmDisabled,
  loading,
  error,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const formId = useId();

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const tooShort = required
    ? trimmed.length < minLength
    : trimmed.length > 0 && trimmed.length < minLength;
  const fieldError = touched && tooShort ? `${minLength}자 이상 입력해 주세요.` : undefined;

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            type="submit"
            form={formId}
            className={danger ? s.dangerSolid : undefined}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={s.dialogBody}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (tooShort || confirmDisabled || loading) return;
          onConfirm(trimmed);
        }}
      >
        {target && (
          <div className={s.dialogTarget}>
            {target.title}
            {target.sub && <small>{target.sub}</small>}
          </div>
        )}
        {children}
        <div>
          {presets && presets.length > 0 && (
            <div className={s.presets} role="group" aria-labelledby={`${formId}-presets`}>
              <span id={`${formId}-presets`} className={s.presetsLabel}>
                자주 쓰는 사유 — 누르면 아래에 입력돼요
              </span>
              {presets.map((p) => (
                <Chip key={p} selected={trimmed === p} onClick={() => setReason(p)}>
                  {p}
                </Chip>
              ))}
            </div>
          )}
          <Textarea
            label={reasonLabel}
            required={required}
            rows={4}
            maxLength={maxLength}
            placeholder={placeholder}
            value={reason}
            help={help}
            error={fieldError ?? error ?? undefined}
            onChange={(e) => setReason(e.target.value)}
            // Leaving an EMPTY field (취소, a preset chip) is not an error yet — submitting is.
            onBlur={() => {
              if (reason.trim()) setTouched(true);
            }}
            data-autofocus
          />
          <p className={s.counter} aria-hidden="true">
            {reason.length}/{maxLength}
          </p>
        </div>
      </form>
    </Modal>
  );
}
