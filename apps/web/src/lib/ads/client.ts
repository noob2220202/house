'use client';
import type { BannerSlot } from '@house/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, type RefObject } from 'react';
import { api } from '@/lib/api';
import { servedBannersQuery, type BannerTarget } from './query';
import type { ServedBanner } from './schemas';

export { servedBannersQuery, type BannerTarget } from './query';

/**
 * THE ads client: every banner slot reads `GET /banners` through `useServedBanners`, links through
 * `bannerClickHref` and counts impressions with `useAdImpression` (≥ 50 % on screen, once).
 */

/**
 * Live banners of a slot. The previous answer stays on screen while a new target loads, so a
 * slot never blinks out when the map moves to another 동. `initialData` = server-fetched banners.
 */
export function useServedBanners(
  slot: BannerSlot,
  target: BannerTarget = {},
  options: { initialData?: ServedBanner[]; enabled?: boolean } = {},
) {
  return useQuery({
    ...servedBannersQuery(slot, target),
    placeholderData: keepPreviousData,
    initialData: options.initialData,
    enabled: options.enabled ?? true,
  });
}

/** Click-through URL: the ads click-redirect endpoint (counts the click, then 302s; works without JS). */
export { bannerClickHref } from './links';

/** Fire-and-forget impression beacon; failures are ignored. */
function sendImpression(bannerId: string): void {
  void api.post(`/banners/${encodeURIComponent(bannerId)}/impression`).catch(() => undefined);
}

/**
 * Impression of a banner: `POST /banners/:id/impression` once per mount (and banner id), when at
 * least half of `ref`'s element is on screen. `enabled: false` (a collapsed teaser, a slide that is
 * not ready) holds it back. Beacon failures never surface.
 */
export function useAdImpression(
  ref: RefObject<Element | null>,
  bannerId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): void {
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !bannerId || !el || sent.current.has(bannerId)) return;
    const send = () => {
      if (sent.current.has(bannerId)) return;
      sent.current.add(bannerId);
      sendImpression(bannerId);
    };
    if (typeof IntersectionObserver === 'undefined') {
      send();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
          send();
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, bannerId, enabled]);
}
