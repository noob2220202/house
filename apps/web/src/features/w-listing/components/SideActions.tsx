'use client';
import { Icon, cx } from '@house/ui';
import { useEffect, useRef } from 'react';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { formatCount } from '@/lib/format';
import { useAdImpression } from '@/lib/ads/client';
import { recordListingView } from '../api/client';
import type { CalcPreview } from '../lib/calcPreview';
import { pushRecentListing, type RecentListing } from '../lib/recent';
import { displayPhone, listingName, telHref } from '../lib/view';
import { Glyph } from './icons';
import { useListingInteractions } from './ListingInteractions';
import styles from './side.module.css';

/** 관심 · 공유 · 허위매물 신고 (desktop aside). */
export function ActionsBar() {
  const { listing, favorite, openShare, openReport } = useListingInteractions();
  return (
    <div className={styles.acts}>
      <button
        type="button"
        className={cx(styles.act, favorite.on && styles.actOn)}
        aria-pressed={favorite.on}
        aria-label={`${favoriteLabel('listings', listingName(listing), favorite.on)}, 현재 ${formatCount(favorite.count)}명이 관심`}
        onClick={favorite.toggle}
      >
        <Icon name="heart" size={20} filled={favorite.on} />
        <span>
          관심 <span className="num">{formatCount(favorite.count)}</span>
        </span>
      </button>
      <button type="button" className={styles.act} onClick={openShare}>
        <Icon name="share" size={20} />
        <span>공유</span>
      </button>
      <button type="button" className={cx(styles.act, styles.actWarn)} onClick={openReport}>
        <Icon name="siren" size={20} />
        <span>허위매물 신고</span>
      </button>
    </div>
  );
}

/** "이 가격으로 계산해 보기" — each row opens the inline calculator sheet on its tab. */
export function CalcCard({ rows }: { rows: readonly CalcPreview[] }) {
  const { openCalc } = useListingInteractions();
  if (rows.length === 0) return null;
  return (
    <section className={cx(styles.scard, styles.calcCard)} aria-labelledby="s-calc">
      <div className={cx(styles.scardHd, styles.scardHdRow)}>
        <h2 className={styles.scardT} id="s-calc">
          <Icon name="calc" size={20} />이 가격으로 계산해 보기
        </h2>
      </div>
      <ul className={styles.calc}>
        {rows.map((row) => (
          <li key={row.tab}>
            <button type="button" onClick={() => openCalc(row.tab)} aria-haspopup="dialog">
              <span className={styles.calcBody}>
                <span className={styles.calcK}>{row.label}</span>
                <b className="num">{row.value}</b>
                <span className={styles.calcS}>{row.note}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mobile footer row: listing number + 허위매물 신고. */
export function MobileFoot({ listingNo, viewCount }: { listingNo: string; viewCount: number }) {
  const { openReport } = useListingInteractions();
  return (
    <div className={styles.mFoot}>
      <p className={styles.mId}>
        매물번호 <b className="num">{listingNo}</b>
        <span aria-hidden="true">·</span>조회 <span className="num">{formatCount(viewCount)}</span>
      </p>
      <button type="button" className={styles.mReport} onClick={openReport}>
        <Icon name="siren" size={18} />
        허위매물 신고
      </button>
    </div>
  );
}

/** Sticky inquiry bar on mobile (MobileListing .ml-cta). */
export function MobileCta() {
  const { listing, openContact } = useListingInteractions();
  const primary = listing.agencies.find((a) => a.isPrimary) ?? listing.agencies[0];
  if (!primary) return null;
  const phone = primary.contactPhone ?? primary.phone;
  const others = listing.agencies.length - 1;
  return (
    <div className={styles.cta} role="region" aria-label="문의하기">
      <p className={styles.ctaWho}>
        <span className={styles.ctaDot} aria-hidden="true" />
        <b>{primary.name}</b>
        {others > 0 ? ` 외 ${others}곳` : ''}
        {primary.avgResponseMinutes ? (
          <>
            {' '}
            · 평균 응답 <span className="num">{primary.avgResponseMinutes}분</span>
          </>
        ) : null}
      </p>
      <div className={styles.ctaBtns}>
        <a
          className={cx(styles.ctaBtn, styles.ctaCall)}
          href={telHref(phone)}
          aria-label={`전화 문의, ${displayPhone(phone)}`}
        >
          <Icon name="phone" size={20} />
          전화 문의
        </a>
        <button
          type="button"
          className={cx(styles.ctaBtn, styles.ctaAsk)}
          onClick={() => openContact()}
        >
          <Glyph name="message" size={20} />
          문의하기
        </button>
      </div>
    </div>
  );
}

/**
 * Recent-view tracking: stores the listing in localStorage (works signed-out) and pings the view
 * endpoint once per page view (view counter + server-side recent view for signed-in users).
 */
export function RecentViewTracker({ entry }: { entry: Omit<RecentListing, 'viewedAt'> }) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (done.current === entry.id) return;
    done.current = entry.id;
    pushRecentListing(entry);
    recordListingView(entry.id).catch(() => undefined);
  }, [entry]);
  return null;
}

/** Fires the banner impression beacon once the ad is actually on screen (shared ads client). */
export function AdImpression({ bannerId }: { bannerId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useAdImpression(ref, bannerId);
  return <span ref={ref} className={styles.adProbe} aria-hidden="true" />;
}
