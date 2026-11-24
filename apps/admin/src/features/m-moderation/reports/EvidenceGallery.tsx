'use client';
import { Icon, IconButton, Modal } from '@house/ui';
import { useEffect, useState, type ReactNode } from 'react';
import r from './reports.module.css';
import { MediaImage } from '../ui/MediaImage';

export interface EvidenceItem {
  id: string;
  url: string;
  fileName?: string | null;
}

export interface ImageLightboxProps {
  items: readonly EvidenceItem[];
  /** Open image; null closes the lightbox. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  title: string;
  /** Alt text stem: "<subject> <altNoun> 3". */
  subject: string;
  altNoun: string;
  /** Line under the image (e.g. the confidentiality reminder of report evidence). */
  note?: ReactNode;
  /** Private files behind an authorized endpoint: never through the image optimizer. */
  restricted?: boolean;
}

/** Full-size image viewer with ←/→ (keys and buttons) between the images of a set. */
export function ImageLightbox({
  items,
  index,
  onIndexChange,
  title,
  subject,
  altNoun,
  note,
  restricted,
}: ImageLightboxProps) {
  const open = index !== null;
  const current = index !== null ? items[index] : undefined;
  const many = items.length > 1;

  useEffect(() => {
    if (!open || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndexChange(((index ?? 0) + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndexChange(((index ?? 0) - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, many, index, items.length, onIndexChange]);

  return (
    <Modal
      open={open}
      onClose={() => onIndexChange(null)}
      size="lg"
      title={title}
      description={current ? (current.fileName ?? subject) : undefined}
    >
      {current && index !== null && (
        <div className={r.lightbox}>
          <div className={r.lightboxStage}>
            <MediaImage
              src={current.url}
              alt={`${subject} ${altNoun} ${index + 1}`}
              sizes="(max-width: 720px) 100vw, 860px"
              contain
              restricted={restricted}
            />
          </div>
          <div className={r.lightboxBar}>
            {note ? <p className={r.lightboxNote}>{note}</p> : <span />}
            {many && (
              <div className={r.lightboxNav} role="group" aria-label={`${title} 넘기기`}>
                <IconButton
                  label="이전"
                  size={36}
                  onClick={() => onIndexChange((index - 1 + items.length) % items.length)}
                >
                  <Icon name="chevron-left" size={18} />
                </IconButton>
                <span className={r.lightboxCount} aria-live="polite">
                  {index + 1} / {items.length}
                </span>
                <IconButton
                  label="다음"
                  size={36}
                  onClick={() => onIndexChange((index + 1) % items.length)}
                >
                  <Icon name="chevron-right" size={18} />
                </IconButton>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Evidence images attached to a report: thumbnail grid + a lightbox (←/→ to move between files).
 * The files can contain third-party personal data, so they are never optimised / cached.
 */
export function EvidenceGallery({
  items,
  subject,
}: {
  items: readonly EvidenceItem[];
  subject: string;
}) {
  const [index, setIndex] = useState<number | null>(null);

  return (
    <>
      <ul className={r.evidence}>
        {items.map((item, i) => {
          const name = item.fileName ?? `증빙 ${i + 1}`;
          return (
            <li key={item.id} className={r.evidenceItem}>
              <button
                type="button"
                className={r.evidenceBtn}
                onClick={() => setIndex(i)}
                aria-label={`${name} 크게 보기`}
              >
                <MediaImage src={item.url} alt="" sizes="160px" restricted />
                <span className={r.evidenceZoom} aria-hidden="true">
                  <Icon name="expand" size={14} />
                </span>
              </button>
              <span className={r.evidenceName} title={name}>
                {name}
              </span>
            </li>
          );
        })}
      </ul>

      <ImageLightbox
        items={items}
        index={index}
        onIndexChange={setIndex}
        title="증빙 자료"
        subject={subject}
        altNoun="증빙 자료"
        restricted
        note={
          <>
            <Icon name="shield" size={14} />
            신고자가 낸 자료예요. 처리 목적 외 저장·공유는 금지돼요.
          </>
        }
      />
    </>
  );
}
