'use client';
import { Icon, PhotoPlaceholder, cx, type PhotoKind } from '@house/ui';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListingPhoto } from '../api/schemas';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { mediaImage } from '../lib/media';
import { listingName } from '../lib/view';
import { BackToMapLink } from './BackToMapLink';
import styles from './gallery.module.css';
import { useListingInteractions } from './ListingInteractions';

const Lightbox = dynamic(() => import('./Lightbox').then((m) => m.Lightbox), { ssr: false });

/** Number of tiles in the desktop mosaic. */
const GRID_MAX = 5;

export interface GalleryProps {
  photos: readonly ListingPhoto[];
  /** Used for alt texts: "신대 레이크파크 1단지 103동". */
  title: string;
  /** "현장 촬영 26.11.20" — shown when a site-visit verification exists. */
  shotLabel?: string | null;
  placeholder: PhotoKind;
  /** Fallback target of the mobile back button (the map centred on the listing). */
  backHref: string;
}

/** Short thumbnail label: "단지 전경 · 호수공원에서" → "전경", "평면도 34A" → "평면도". */
export function shortCaption(caption: string | null | undefined, index: number): string {
  const head = caption?.split('·')[0]?.trim();
  if (!head) return `사진 ${index + 1}`;
  if (head.length <= 4) return head;
  const words = head.split(/\s+/);
  const last = words[words.length - 1] ?? head;
  return /[0-9A-Za-z]/.test(last) ? (words[0] ?? head) : last;
}

/**
 * Listing photos. One DOM for both layouts: a 5-tile mosaic on desktop, a swipeable scroll-snap
 * carousel with floating actions and category thumbnails on mobile (MobileListing). Every tile opens
 * the lightbox (keyboard + swipe).
 */
export function Gallery({ photos, title, shotLabel, placeholder, backHref }: GalleryProps) {
  const { listing, office, favorite, openShare } = useListingInteractions();
  const total = photos.length;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Mobile carousel position → counter, caption and thumbnail highlight.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth) {
          setActive(Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [total]);

  const scrollToSlide = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el || typeof el.scrollTo !== 'function') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const open = (index: number, opener?: HTMLElement | null) => {
    openerRef.current = opener ?? null;
    setLightbox(index);
  };
  const close = (index: number) => {
    setLightbox(null);
    scrollToSlide(index);
    openerRef.current?.focus();
  };

  const mobileActions = (
    <div className={styles.mTop}>
      {office ? (
        <Link className={styles.fab} href={backHref} aria-label={`${office.name} 홈으로`}>
          <Icon name="chevron-left" size={22} />
        </Link>
      ) : (
        <BackToMapLink className={styles.fab} href={backHref} aria-label="지도로 돌아가기">
          <Icon name="chevron-left" size={22} />
        </BackToMapLink>
      )}
      <span className={styles.fabGap} />
      <button type="button" className={styles.fab} aria-label="공유하기" onClick={openShare}>
        <Icon name="share" size={20} />
      </button>
      {/* 관심 needs a session: none on an office's 홈페이지. */}
      {!office && (
        <button
          type="button"
          className={cx(styles.fab, favorite.on && styles.fabOn)}
          aria-label={favoriteLabel('listings', listingName(listing), favorite.on)}
          aria-pressed={favorite.on}
          onClick={favorite.toggle}
        >
          <Icon name="heart" size={20} filled={favorite.on} />
        </button>
      )}
    </div>
  );

  if (total === 0) {
    return (
      <section className={cx(styles.gal, styles.empty)} aria-label="매물 사진">
        <div className={styles.emptyArt}>
          <PhotoPlaceholder kind={placeholder} label={`${title} 사진 준비 중`} />
          <span className={styles.cap}>등록된 사진이 아직 없어요</span>
        </div>
        {mobileActions}
      </section>
    );
  }

  const shown = Math.min(total, GRID_MAX);
  // The last tile is covered by the "+N" overlay, so its own photo counts as one of the N (design: 14 → "+10").
  const more = total > GRID_MAX ? total - (GRID_MAX - 1) : 0;
  const current = photos[active] ?? photos[0];
  const thumbs = photos.slice(0, 5);

  return (
    <section
      className={styles.gal}
      aria-roledescription="carousel"
      aria-label={`매물 사진 ${total}장`}
    >
      <div ref={trackRef} className={cx(styles.track, styles[`n${shown}`])}>
        {photos.map((photo, i) => {
          const last = i === GRID_MAX - 1 && more > 0;
          return (
            <button
              key={photo.id}
              type="button"
              className={cx(styles.tile, i === 0 && styles.main, i >= GRID_MAX && styles.extra)}
              aria-label={
                last
                  ? `사진 ${total}장 모두 보기`
                  : `사진 ${i + 1} / ${total}. ${photo.caption ?? title} 크게 보기`
              }
              onClick={(e) => open(i, e.currentTarget)}
            >
              <Image
                {...mediaImage(photo.url)}
                alt={i === 0 ? `${title} ${photo.caption ?? '대표 사진'}` : ''}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
                sizes={
                  i === 0
                    ? '(max-width: 720px) 100vw, (max-width: 1288px) 50vw, 640px'
                    : '(max-width: 720px) 100vw, (max-width: 1288px) 25vw, 320px'
                }
              />
              {i === 0 && shotLabel && (
                <span className={styles.tag}>
                  <Icon name="check-circle" size={16} />
                  {shotLabel}
                </span>
              )}
              {photo.caption && !last && <span className={styles.cap}>{photo.caption}</span>}
              {last && (
                <span className={styles.more}>
                  <span className={cx(styles.moreN, 'num')}>+{more}</span>
                  <span className={styles.moreT}>
                    <Icon name="grid" size={16} />
                    사진 {total}장 모두 보기
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {mobileActions}
      <div className={styles.mBot}>
        <span className={styles.mCap}>
          {shotLabel && active === 0 ? (
            <>
              <Icon name="check-circle" size={16} />
              {shotLabel} · {shortCaption(current?.caption, active)}
            </>
          ) : (
            (current?.caption ?? shortCaption(null, active))
          )}
        </span>
        <button
          type="button"
          className={styles.mCount}
          aria-label={`사진 ${total}장 모두 보기`}
          onClick={(e) => open(active, e.currentTarget)}
        >
          <Icon name="grid" size={16} />
          <span className="num" aria-hidden="true">
            <b>{active + 1}</b> / {total}
          </span>
        </button>
      </div>
      {thumbs.length > 1 && (
        <ol className={styles.mThumbs} aria-label="사진 바로가기">
          {thumbs.map((photo, i) => (
            <li key={photo.id}>
              <button
                type="button"
                className={cx(styles.thumb, i === active && styles.thumbOn)}
                aria-current={i === active ? 'true' : undefined}
                aria-label={`${shortCaption(photo.caption, i)} 사진으로 이동`}
                onClick={() => scrollToSlide(i)}
              >
                <Image
                  {...mediaImage(photo.thumbUrl ?? photo.url)}
                  alt=""
                  fill
                  sizes="72px"
                  loading="lazy"
                />
                <span>{shortCaption(photo.caption, i)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {lightbox !== null && (
        <Lightbox
          photos={photos}
          title={title}
          index={lightbox}
          onIndexChange={setLightbox}
          onClose={close}
        />
      )}
    </section>
  );
}
