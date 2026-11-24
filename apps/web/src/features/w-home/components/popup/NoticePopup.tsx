'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Popup } from '../../api/schemas';
import { imageProps } from '../../lib/media';
import { dismissLabel, popupLink } from '../../lib/popup';
import styles from './NoticePopup.module.css';

export interface NoticePopupProps {
  popup: Popup;
  /** "1 / 2" when more popups are queued behind this one. */
  position?: { index: number; total: number };
  /** 닫기 (also Esc). */
  onClose: () => void;
  /** "N일 동안 보지 않기". */
  onDismiss: () => void;
}

/**
 * Notice popup (DesignSystem `.notice`): the creative + a two-button footer, shown as a
 * NON-blocking card so it never hides the hero search on a first visit — a corner card on wide
 * screens, a bottom sheet (≤ 50% of the viewport height) on phones. No scrim, no scroll lock, no
 * focus trap; Esc = 닫기. Keyboard users reach it as the last landmark ("공지" dialog).
 */
export function NoticePopup({ popup, position, onClose, onDismiss }: NoticePopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const link = popupLink(popup.linkUrl);
  const hideLabel = dismissLabel(popup.dismissDays);
  const image = (
    <Image
      {...imageProps(popup.imageUrl)}
      alt={popup.title}
      fill
      sizes="(max-width: 720px) 100vw, 340px"
      priority
    />
  );
  let art: ReactNode = image;
  if (link?.kind === 'internal') {
    art = (
      <Link href={link.href} className={styles.artLink} onClick={onClose}>
        {image}
      </Link>
    );
  } else if (link?.kind === 'external') {
    art = (
      <a
        href={link.href}
        className={styles.artLink}
        target={popup.newWindow ? '_blank' : undefined}
        rel={popup.newWindow ? 'noopener noreferrer' : undefined}
        onClick={onClose}
      >
        {image}
      </a>
    );
  }

  return createPortal(
    <div className={styles.layer}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.notice}
      >
        <h2 id={titleId} className="sr-only">
          공지: {popup.title}
        </h2>
        <div className={styles.art}>
          {art}
          {position && (
            <span className={styles.count}>
              <span aria-hidden="true">
                {position.index} / {position.total}
              </span>
              <span className="sr-only">
                공지 {position.total}개 중 {position.index}번째
              </span>
            </span>
          )}
        </div>
        <div className={hideLabel ? styles.footer : `${styles.footer} ${styles.single}`}>
          {hideLabel && (
            <button type="button" onClick={onDismiss}>
              {hideLabel}
            </button>
          )}
          <button type="button" className={styles.close} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
