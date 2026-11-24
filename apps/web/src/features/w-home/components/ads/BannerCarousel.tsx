'use client';
import { AdFrame, Icon, cx } from '@house/ui';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BannerPicture, bannerClickHref } from '@/lib/ads';
import { useAdImpression } from '@/lib/ads/client';
import type { Banner } from '../../api/schemas';
import styles from './BannerCarousel.module.css';

const ROTATE_MS = 6000;
const PC_SIZES = '(max-width: 1336px) 100vw, 1240px';

/**
 * One slide. Impression: `useAdImpression` (≥ 50 % of the slide on screen — hidden or
 * scrolled-away slides do not count — once per mount). `eager` = first slide of a carousel in the
 * first mobile viewport (the LCP element of MobileHome: it must not wait for lazy loading).
 */
function Slide({
  banner: b,
  index,
  count,
  current,
  eager,
}: {
  banner: Banner;
  index: number;
  count: number;
  current: boolean;
  eager: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useAdImpression(ref, b.id);
  const name = [b.advertiserName, b.title].filter(Boolean).join(': ');
  return (
    <div
      ref={ref}
      className={styles.slide}
      role="group"
      aria-roledescription="슬라이드"
      aria-label={`${count}개 중 ${index + 1}번째`}
      inert={!current}
    >
      <AdFrame
        slot="main"
        className={styles.frame}
        label={name}
        href={b.linkUrl ? bannerClickHref(b.id) : undefined}
        newWindow={b.newWindow}
      >
        {b.imageUrl && (
          <BannerPicture
            src={b.imageUrl}
            mobileSrc={b.mobileImageUrl}
            sizes={PC_SIZES}
            eager={eager}
          />
        )}
      </AdFrame>
    </div>
  );
}

export interface BannerCarouselProps {
  banners: readonly Banner[];
  /** `main` = wide carousel with arrows and dots (MAIN_HERO); `strip` = thin band (MAIN_STRIP). */
  variant?: 'main' | 'strip';
  /** Accessible name of the region. */
  label?: string;
  /** Load the first slide eagerly (the carousel is in the first mobile viewport). */
  eager?: boolean;
  className?: string;
}

/**
 * Admin-managed banner slot. Slides are native scroll-snap (touch swipe for free); the frame, AD
 * badge, advertiser name (wide carousel, desktop) and pager are fixed chrome on top of the creative,
 * which is the uploaded image.
 * - Impression: `POST /banners/:id/impression` once per mount, when ≥ 50% of the slide is
 *   actually on screen (shared `useAdImpression` — hidden or scrolled-away slides do not count).
 * - Click: plain link to `GET /banners/:id/click`, which counts and redirects (works without JS).
 * - Auto-rotation pauses on hover/focus and while the tab is hidden, never starts for
 *   reduced-motion users, and stops for good once the visitor takes over (swipe, arrows, pager) or
 *   uses the pause button in the pager (KWCAG 자동 변경 콘텐츠 제어; revealed on keyboard focus).
 */
export function BannerCarousel({
  banners,
  variant = 'main',
  label = '광고',
  eager = false,
  className,
}: BannerCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /** False once the visitor navigated by hand or pressed pause. */
  const [auto, setAuto] = useState(true);
  const count = banners.length;

  const goTo = useCallback(
    (next: number, smooth = true) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      const target = ((next % count) + count) % count;
      track.scrollTo({ left: target * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    },
    [count],
  );

  // Active slide follows the scroll position (swipe, arrows and auto-rotation all end up here).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Auto-rotation.
  useEffect(() => {
    if (count < 2 || paused || !auto) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      const track = trackRef.current;
      // Skip while the tab is hidden or the carousel is off screen / display:none.
      if (document.hidden || !track || track.clientWidth === 0) return;
      const rect = track.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      goTo(Math.round(track.scrollLeft / track.clientWidth) + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused, auto, goTo]);

  if (count === 0) return null;
  const current = Math.min(index, count - 1);
  const advertiser = variant === 'main' ? banners[current]?.advertiserName : null;

  /** Manual navigation: the visitor is in charge from here on. */
  const step = (delta: number) => {
    setAuto(false);
    goTo(current + delta);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <div
      className={cx(styles.root, variant === 'strip' && styles.strip, className)}
      role="region"
      aria-roledescription="캐러셀"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={count > 1 ? () => setAuto(false) : undefined}
      >
        {banners.map((b, i) => (
          <Slide
            key={b.id}
            banner={b}
            index={i}
            count={count}
            current={i === current}
            eager={eager && i === 0}
          />
        ))}
      </div>

      {/* Main `.ad-adv`: who paid for the slide on screen (already part of the link's name). */}
      {advertiser && (
        <span className={cx(styles.advertiser, count < 2 && styles.alone)} aria-hidden="true">
          {advertiser}
        </span>
      )}

      {count > 1 && (
        <>
          <p className={styles.pager}>
            <span className="num" aria-hidden="true">
              {current + 1} / {count}
            </span>
            {/* Announced only while the visitor is in control: an automatic rotation every few
                seconds must not interrupt a screen reader (WAI-ARIA carousel pattern). */}
            <span className="sr-only" aria-live={auto && !paused ? 'off' : 'polite'}>
              광고 {count}개 중 {current + 1}번째
            </span>
            <button
              type="button"
              className={styles.pagerToggle}
              aria-label={auto ? '광고 자동 넘김 멈춤' : '광고 자동 넘김 시작'}
              onClick={() => setAuto((on) => !on)}
            >
              {auto ? (
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M8 5v14M16 5v14"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <Icon name="play" size={14} filled />
              )}
            </button>
            <button
              type="button"
              className={styles.pagerNext}
              aria-label="다음 광고"
              onClick={() => step(1)}
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </p>
          {variant === 'main' && (
            <>
              <button
                type="button"
                className={cx(styles.arrow, styles.prev)}
                aria-label="이전 광고"
                onClick={() => step(-1)}
              >
                <Icon name="chevron-left" size={22} />
              </button>
              <button
                type="button"
                className={cx(styles.arrow, styles.next)}
                aria-label="다음 광고"
                onClick={() => step(1)}
              >
                <Icon name="chevron-right" size={22} />
              </button>
              <div className={styles.dots} aria-hidden="true">
                {banners.map((b, i) => (
                  <i key={b.id} className={i === current ? styles.dotOn : undefined} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
