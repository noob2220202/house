'use client';
import { Icon, cx, useFocusTrap, useMounted, useScrollLock } from '@house/ui';
import Image from 'next/image';
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ListingPhoto } from '../api/schemas';
import { mediaImage } from '../lib/media';
import styles from './gallery.module.css';

const SWIPE_PX = 48;

/** Pure index maths, exported for tests: wraps around both ends. */
export function stepIndex(index: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((index + delta) % total) + total) % total;
}

export interface LightboxProps {
  photos: readonly ListingPhoto[];
  title: string;
  index: number;
  onIndexChange: (index: number) => void;
  /** Called with the index that was showing, so the gallery can scroll to it. */
  onClose: (index: number) => void;
}

/**
 * Full-screen photo viewer: ← → / Home / End / Esc, swipe left-right (pointer events), focus trap,
 * scroll lock, thumbnail strip. Neighbouring photos are preloaded.
 */
export function Lightbox({ photos, title, index, onIndexChange, onClose }: LightboxProps) {
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const total = photos.length;
  const photo = photos[index] ?? photos[0];
  useFocusTrap(mounted, ref);
  useScrollLock(true);

  const go = useCallback(
    (delta: number) => onIndexChange(stepIndex(index, delta, total)),
    [index, onIndexChange, total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(index);
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Home') onIndexChange(0);
      else if (e.key === 'End') onIndexChange(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, onClose, onIndexChange, total]);

  // Keep the active thumbnail in view.
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[index] as HTMLElement | undefined;
    if (strip && el && typeof strip.scrollTo === 'function') {
      strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2 });
    }
  }, [index, mounted]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
  };

  if (!mounted || !photo) return null;
  const neighbours =
    total > 1 ? [photos[stepIndex(index, 1, total)], photos[stepIndex(index, -1, total)]] : [];

  return createPortal(
    <div
      ref={ref}
      className={styles.lb}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 사진 크게 보기`}
      tabIndex={-1}
    >
      <div className={styles.lbTop}>
        <p className={styles.lbCount} aria-live="polite">
          <b className="num">{index + 1}</b>
          <span className="num"> / {total}</span>
          {photo.caption && <span className={styles.lbCap}>{photo.caption}</span>}
        </p>
        <button
          type="button"
          className={styles.lbBtn}
          aria-label="사진 보기 닫기"
          onClick={() => onClose(index)}
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <div
        className={styles.lbStage}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <Image
          key={photo.id}
          {...mediaImage(photo.url)}
          alt={`${title} ${photo.caption ?? `사진 ${index + 1}`}`}
          fill
          sizes="100vw"
          className={styles.lbImg}
          draggable={false}
        />
        {/* Preload the neighbours so prev/next feel instant. */}
        {neighbours.map(
          (n) =>
            n &&
            n.id !== photo.id && (
              <Image
                key={n.id}
                {...mediaImage(n.url)}
                alt=""
                fill
                sizes="100vw"
                className={styles.lbPreload}
              />
            ),
        )}
        {total > 1 && (
          <>
            <button
              type="button"
              className={cx(styles.lbBtn, styles.lbNav, styles.lbPrev)}
              aria-label="이전 사진"
              onClick={() => go(-1)}
            >
              <Icon name="chevron-left" size={26} />
            </button>
            <button
              type="button"
              className={cx(styles.lbBtn, styles.lbNav, styles.lbNext)}
              aria-label="다음 사진"
              onClick={() => go(1)}
            >
              <Icon name="chevron-right" size={26} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <ol ref={stripRef} className={styles.lbStrip} aria-label="사진 목록">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={cx(styles.lbThumb, i === index && styles.lbThumbOn)}
                aria-label={`사진 ${i + 1}${p.caption ? `. ${p.caption}` : ''}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => onIndexChange(i)}
              >
                <Image
                  {...mediaImage(p.thumbUrl ?? p.url)}
                  alt=""
                  fill
                  sizes="88px"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>,
    document.body,
  );
}
