'use client';
import { useId, type ReactNode } from 'react';
import styles from './Modal.module.css';
import { cx } from '../lib/cx';
import { IconButton } from './IconButton';
import { Overlay } from './Overlay';
import { Icon } from '../icons/Icon';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions (buttons). Right-aligned on desktop, stacked full-width on mobile. */
  footer?: ReactNode;
  /** sm 440 (default) · md 560 · lg 720 */
  size?: 'sm' | 'md' | 'lg';
  closeOnScrim?: boolean;
  /** Hide the × button (confirm dialogs that require an explicit choice). */
  hideClose?: boolean;
  className?: string;
}

/** Modal dialog: focus-trapped, Esc/scrim to close, focus returns to the opener. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
  closeOnScrim,
  hideClose,
  className,
}: ModalProps) {
  const id = useId();
  return (
    <Overlay
      open={open}
      onClose={onClose}
      align="center"
      closeOnScrim={closeOnScrim}
      labelledBy={`${id}-t`}
      describedBy={description ? `${id}-d` : undefined}
      className={cx(styles.modal, styles[size], className)}
    >
      <div className={styles.hd}>
        <h2 id={`${id}-t`} className={styles.title}>
          {title}
        </h2>
        {!hideClose && (
          <IconButton label="닫기" variant="plain" size={36} onClick={onClose}>
            <Icon name="close" size={20} />
          </IconButton>
        )}
      </div>
      <div className={styles.bd}>
        {description && (
          <p id={`${id}-d`} className={styles.desc}>
            {description}
          </p>
        )}
        {children}
      </div>
      {footer && <div className={styles.ft}>{footer}</div>}
    </Overlay>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling for destructive confirmations. */
  danger?: boolean;
  loading?: boolean;
}

/** Two-button confirmation dialog. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger,
  loading,
}: ConfirmDialogProps) {
  const id = useId();
  return (
    <Overlay
      open={open}
      onClose={onClose}
      align="center"
      labelledBy={`${id}-t`}
      describedBy={description ? `${id}-d` : undefined}
      className={cx(styles.modal)}
    >
      <div className={styles.hd}>
        <h2 id={`${id}-t`} className={styles.title}>
          {title}
        </h2>
      </div>
      <div className={styles.bd}>
        {description && (
          <p id={`${id}-d`} className={styles.desc}>
            {description}
          </p>
        )}
      </div>
      <div className={styles.ft}>
        <button type="button" className={styles.cancel} onClick={onClose} data-autofocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cx(styles.confirm, danger && styles.confirmDanger)}
          onClick={onConfirm}
          disabled={loading}
          aria-busy={loading || undefined}
        >
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}
