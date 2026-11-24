'use client';
import { AdBadge, Icon, cx } from '@house/ui';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { BannerPicture, bannerClickHref } from '@/lib/ads';
import { useAdImpression } from '@/lib/ads/client';
import { formatPhone } from '@/lib/format';
import { useAdAgency, useMapBanners } from '../../api/queries';
import type { AdAgency, MapBanner } from '../../api/schemas';
import { closeAdSlot, isAdSlotClosed, nextAdRotation } from '../../lib/storage';
import s from './map.module.css';

/** "전라남도 순천시 조례동 호수공원길 24, 1층" → "조례동 호수공원길 24". */
export function shortAddress(road: string | null | undefined): string {
  if (!road) return '';
  return (road.split(',')[0] ?? road)
    .replace(/^(전라남도|전남)\s*/, '')
    .replace(/^순천시\s*/, '')
    .trim();
}

function responseText(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)}시간` : `${Math.round(minutes)}분`;
}

function AgencyBody({ banner, agency }: { banner: MapBanner; agency: AdAgency }) {
  const stats = [
    agency.activeListingCount != null && {
      value: String(agency.activeListingCount),
      label: '보유 매물',
    },
    agency.stats?.deals30d != null && { value: String(agency.stats.deals30d), label: '30일 거래' },
    agency.stats?.avgResponseMinutes != null && {
      value: responseText(agency.stats.avgResponseMinutes),
      label: '평균 응답',
    },
  ].filter((x): x is { value: string; label: string } => !!x);
  const href = banner.linkUrl ? bannerClickHref(banner.id) : ROUTES.agency(agency.id);
  const meta = [
    agency.representativeName ? `대표 공인중개사 ${agency.representativeName}` : null,
    shortAddress(agency.roadAddress),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <p className={s.adName}>
        {banner.linkUrl ? (
          <a href={href} target={banner.newWindow ? '_blank' : undefined} rel="sponsored noopener">
            {agency.name}
          </a>
        ) : (
          <Link href={href}>{agency.name}</Link>
        )}
      </p>
      {meta && <p className={s.adMeta}>{meta}</p>}
      {stats.length > 0 && (
        <div className={s.adStats} style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map((st) => (
            <span key={st.label}>
              <b>{st.value}</b>
              {st.label}
            </span>
          ))}
        </div>
      )}
      {agency.phone && (
        <a className={s.adCall} href={`tel:${agency.phone.replace(/[^\d+]/g, '')}`}>
          <Icon name="phone" size={18} />
          {formatPhone(agency.phone)} 전화 문의
        </a>
      )}
    </>
  );
}

function ImageBody({ banner }: { banner: MapBanner }) {
  const image = banner.imageUrl ? (
    <span className={s.adImage}>
      <BannerPicture src={banner.imageUrl} mobileSrc={banner.mobileImageUrl} sizes="300px" />
    </span>
  ) : null;
  const title = <span className={s.adName}>{banner.advertiserName ?? banner.title}</span>;
  if (!banner.linkUrl) {
    return (
      <div className={s.adLink}>
        {image}
        {title}
      </div>
    );
  }
  return (
    <a
      className={s.adLink}
      href={bannerClickHref(banner.id)}
      target={banner.newWindow ? '_blank' : undefined}
      rel="sponsored noopener"
    >
      {image}
      {title}
    </a>
  );
}

export interface MapAdProps {
  /** Region in view → `regionCode` targeting. */
  regionCode?: string | null;
  /** Selected complex → `complexId` targeting (아파트 map). */
  complexId?: string | null;
  /** Collapsed pill that expands on tap (mobile, short or narrow desktop maps). */
  compact?: boolean;
  /** Compact only: the pill was expanded / collapsed (the mobile page lowers its sheet). */
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

/** Seconds a banner stays up before the next live banner of the slot takes its place. */
export const AD_ROTATE_MS = 9000;

/** Banner shown at `step` of a rotation that started at `start` (both may exceed the length). */
export function rotationIndex(start: number, step: number, length: number): number {
  return length > 0 ? (((start + step) % length) + length) % length : 0;
}

// One start index per page view (module scope = one full page load), read lazily on the client.
let pageStart: number | null = null;
const rotationStart = () => (pageStart ??= nextAdRotation());

/**
 * MAP_AD slot as a floating card. The slot may hold several live banners: every page view starts on
 * the next one and the card moves on every few seconds (paused while hovered, focused or expanded,
 * and for visitors who prefer reduced motion). Closing it closes the whole slot for the browser
 * session. Agency banners render the text card of the design (상호 · 대표 · 통계 · 전화); other
 * advertisers render their image creative. One impression per banner per page view, sent when the
 * banner is actually drawn.
 */
export function MapAd({ regionCode, complexId, compact, onExpandedChange, className }: MapAdProps) {
  const banners = useMapBanners(regionCode, complexId);
  // Session state is read after mount (sessionStorage is not available while server rendering).
  const [slot, setSlot] = useState<{ closed: boolean; start: number } | null>(null);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => setSlot({ closed: isAdSlotClosed(), start: rotationStart() }), []);

  const list = slot && !slot.closed ? (banners.data ?? []) : [];
  const banner = slot ? list[rotationIndex(slot.start, step, list.length)] : undefined;
  const upNext = slot ? list[rotationIndex(slot.start, step + 1, list.length)] : undefined;
  const agency = useAdAgency(banner?.agencyId);
  // Warm the next office so the card swaps in one piece instead of blinking out while it loads.
  const nextAgency = useAdAgency(upNext?.agencyId);
  const waiting = !!banner?.agencyId && agency.isPending;
  const nextReady = !upNext?.agencyId || !nextAgency.isPending;

  const expanded = !!compact && open;
  // An impression is the creative on screen: the full card, or the pill once expanded — the
  // collapsed pill (name only) is a teaser and is not counted.
  const shownId = banner && !waiting && (!compact || open) ? banner.id : undefined;
  const cardRef = useRef<HTMLElement>(null);
  useAdImpression(cardRef, shownId, { enabled: !!shownId });

  const rotating = list.length > 1 && !held && !expanded && nextReady;
  useEffect(() => {
    if (!rotating) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setStep((n) => n + 1);
    }, AD_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating]);

  const onExpanded = useRef(onExpandedChange);
  onExpanded.current = onExpandedChange;
  const expand = (next: boolean) => {
    setOpen(next);
    onExpanded.current?.(next);
  };

  if (!banner || waiting) return null;
  const office = agency.data;
  const name = office?.name ?? banner.advertiserName ?? banner.title;
  const close = () => {
    closeAdSlot();
    setSlot((s) => (s ? { ...s, closed: true } : s));
    if (expanded) expand(false);
  };
  const hold = {
    onMouseEnter: () => setHeld(true),
    onMouseLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };

  if (compact && !open) {
    return (
      <button
        type="button"
        className={cx(s.adMin, className)}
        aria-expanded={false}
        aria-label={`광고 펼치기: ${name}`}
        onClick={() => expand(true)}
        {...hold}
      >
        <AdBadge onDark />
        <span className={s.adMinName}>{name.replace(/사무소$/, '')}</span>
        <Icon name="chevron-down" size={18} />
      </button>
    );
  }
  return (
    <aside
      ref={cardRef}
      className={cx(s.ad, compact && s.adCompact, className)}
      aria-label="광고"
      {...hold}
    >
      <div className={s.adTop}>
        <AdBadge onDark />
        {office?.tagline && <span className={s.adTag}>{office.tagline}</span>}
        {compact && (
          <button
            type="button"
            className={s.adX}
            aria-label="광고 접기"
            aria-expanded
            onClick={() => expand(false)}
          >
            <Icon name="chevron-up" size={18} />
          </button>
        )}
        <button
          type="button"
          className={cx(s.adX, !compact && s.adXEnd)}
          aria-label="광고 닫기"
          onClick={close}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      {office ? <AgencyBody banner={banner} agency={office} /> : <ImageBody banner={banner} />}
    </aside>
  );
}
