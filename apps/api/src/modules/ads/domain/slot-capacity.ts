import { BannerTargeting } from '@house/shared';

export interface TimeWindow {
  startAt: Date;
  endAt: Date;
}

/**
 * Largest number of `others` running at the same instant inside `window` (half-open intervals:
 * a banner ending at T does not overlap one starting at T). Sweep line, O(n log n).
 */
export function peakConcurrency(
  window: TimeWindow,
  others: readonly TimeWindow[],
): { peak: number; at: Date | null } {
  const ws = window.startAt.getTime();
  const we = window.endAt.getTime();
  const events: [number, 1 | -1][] = [];
  for (const o of others) {
    const s = Math.max(o.startAt.getTime(), ws);
    const e = Math.min(o.endAt.getTime(), we);
    if (s >= e) continue;
    events.push([s, 1], [e, -1]);
  }
  // Ends sort before starts at the same instant.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  let at: number | null = null;
  for (const [time, delta] of events) {
    current += delta;
    if (current > peak) {
      peak = current;
      at = time;
    }
  }
  return { peak, at: at === null ? null : new Date(at) };
}

/** A banner as far as slot capacity is concerned: its window and where it is shown. */
export interface PlacedWindow extends TimeWindow {
  targeting: BannerTargeting;
  regionCodes: readonly string[];
  complexIds: readonly string[];
}

/**
 * A page a slot is rendered on. `global` = no region/complex context (only ALL banners show);
 * `region` = a page for a 법정동 code; `complex` = a complex page (its 시군구/읍면동 codes).
 */
export type CapacityContext =
  | { kind: 'global' }
  | { kind: 'region'; regionCode: string }
  | { kind: 'complex'; complexId: string; regionCodes: readonly string[] };

/** Same matching rules as AdServeService.computeBanners (region codes match by prefix). */
export function appearsIn(b: Omit<PlacedWindow, keyof TimeWindow>, ctx: CapacityContext): boolean {
  if (b.targeting === BannerTargeting.ALL) return true;
  if (ctx.kind === 'global') return false;
  if (ctx.kind === 'region') {
    return (
      b.targeting === BannerTargeting.REGIONS &&
      b.regionCodes.some((s) => ctx.regionCode.startsWith(s))
    );
  }
  if (b.targeting === BannerTargeting.COMPLEXES) return b.complexIds.includes(ctx.complexId);
  return b.regionCodes.some((s) => ctx.regionCodes.some((k) => k.startsWith(s)));
}

/**
 * Every page context the new banner appears in where the set of competing banners can differ.
 * For region pages the competitor set only grows as the code gets deeper, so the target code
 * itself plus the deeper codes other banners target are enough; complex pages only differ from
 * their 읍면동 page when some banner targets that complex.
 */
export function candidateContexts(
  banner: Omit<PlacedWindow, keyof TimeWindow>,
  others: readonly Omit<PlacedWindow, keyof TimeWindow>[],
  complexCodes: ReadonlyMap<string, readonly string[]>,
): CapacityContext[] {
  const complexCtx = (complexId: string): CapacityContext => ({
    kind: 'complex',
    complexId,
    regionCodes: complexCodes.get(complexId) ?? [],
  });
  const otherCodes = new Set(others.flatMap((o) => o.regionCodes));
  const otherComplexes = new Set(others.flatMap((o) => o.complexIds));
  const out: CapacityContext[] = [];
  if (banner.targeting === BannerTargeting.COMPLEXES) {
    for (const id of banner.complexIds) out.push(complexCtx(id));
    return out;
  }
  const regionCodes = new Set<string>();
  if (banner.targeting === BannerTargeting.ALL) {
    out.push({ kind: 'global' });
    for (const c of otherCodes) regionCodes.add(c);
  } else {
    for (const r of banner.regionCodes) {
      regionCodes.add(r);
      for (const c of otherCodes) if (c.startsWith(r)) regionCodes.add(c);
    }
  }
  for (const regionCode of [...regionCodes].sort()) out.push({ kind: 'region', regionCode });
  for (const id of [...otherComplexes].sort()) {
    const ctx = complexCtx(id);
    if (appearsIn(banner, ctx)) out.push(ctx);
  }
  return out;
}

/**
 * Worst simultaneous count of `others` inside `window` over the contexts the new banner appears
 * in (the new banner itself not included). `context` is where it happens.
 */
export function worstContextConcurrency(
  window: TimeWindow,
  banner: Omit<PlacedWindow, keyof TimeWindow>,
  others: readonly PlacedWindow[],
  complexCodes: ReadonlyMap<string, readonly string[]>,
): { peak: number; at: Date | null; context: CapacityContext | null } {
  let worst: { peak: number; at: Date | null; context: CapacityContext | null } = {
    peak: 0,
    at: null,
    context: null,
  };
  for (const ctx of candidateContexts(banner, others, complexCodes)) {
    const r = peakConcurrency(
      window,
      others.filter((o) => appearsIn(o, ctx)),
    );
    if (worst.context === null || r.peak > worst.peak) worst = { ...r, context: ctx };
  }
  return worst;
}

type Placement = Omit<PlacedWindow, keyof TimeWindow>;

/**
 * True when `next` may show the banner on a page where `prev` did not (so the slot limit must be
 * re-checked). Narrowing (fewer complexes, deeper region codes, ALL → targeted) never grows.
 */
export function placementGrows(prev: Placement, next: Placement): boolean {
  if (prev.targeting === BannerTargeting.ALL) return false;
  if (next.targeting === BannerTargeting.ALL) return true;
  if (
    prev.targeting === BannerTargeting.COMPLEXES &&
    next.targeting === BannerTargeting.COMPLEXES
  ) {
    return next.complexIds.some((c) => !prev.complexIds.includes(c));
  }
  if (prev.targeting === BannerTargeting.REGIONS && next.targeting === BannerTargeting.REGIONS) {
    return next.regionCodes.some((r) => !prev.regionCodes.some((p) => r.startsWith(p)));
  }
  // REGIONS ↔ COMPLEXES: treated as growing (re-checked) rather than resolving complex codes.
  return true;
}

/** True when `next` is live at some instant `prev` was not (un-pausing, earlier start, later end). */
export function windowGrows(
  prev: TimeWindow & { paused: boolean },
  next: TimeWindow & { paused: boolean },
): boolean {
  if (next.paused) return false;
  return prev.paused || next.startAt < prev.startAt || next.endAt > prev.endAt;
}
