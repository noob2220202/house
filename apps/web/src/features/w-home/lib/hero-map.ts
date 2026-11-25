import { formatCount } from '@/lib/format/number';
import { formatPerPyeong } from '@/lib/format/price';
import { kakaoMetresPerPx } from '@/lib/map/kakao-level';
import type { LatLng } from '@/lib/map/types';
import { DEFAULT_MAP_CENTER } from '@house/shared';
import type { HomeRegion } from '../api/schemas';
import {
  HERO_CHIP_MAX,
  HERO_MAP_FRAME,
  HERO_KAKAO_LEVEL,
  HERO_STATIC_CARD,
  HERO_STATIC_INSETS,
  HERO_STATIC_TOP_BAR,
} from '../config';

/**
 * Layout of the home hero map: which 동 chips are shown and where.
 *
 * Every chip sits at its region's REAL lat/lng. The hero frame is fitted to the bounding box of the
 * busiest regions (equal metres per px on both axes, so the geography is not stretched):
 * - static fallback (no Kakao key / SDK failed / SSR): a continuous scale on a virtual 600×540
 *   frame, positions returned in % so they follow the responsive frame;
 * - Kakao map: the closest Kakao level whose scale fits, positions in px of the measured frame
 *   (only used to decide which chips fit — the SDK itself places the `CustomOverlay`s).
 * Chips that would leave the frame, hide under the top bar / featured card, or overlap an already
 * placed chip are dropped (the highlighted region is placed first, then by listing count).
 */

export type HeroRegionInput = Pick<
  HomeRegion,
  'code' | 'name' | 'lat' | 'lng' | 'listingCount' | 'avgPricePerPyeong' | 'emdName'
>;

export interface HeroRegionChip {
  code: string;
  name: string;
  count: number;
  /** Static fallback: % of the frame. Kakao layout: px of the measured frame. */
  x: number;
  y: number;
  /** Hidden below the desktop layout to keep the small map readable. */
  wideOnly: boolean;
  avgPricePerPyeong: number | null;
  lat: number;
  lng: number;
}

export interface HeroLayout {
  chips: HeroRegionChip[];
  /** Code of the highlighted (brand-coloured, with 평당가) chip. */
  onCode: string | null;
}

export interface Size {
  width: number;
  height: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface GeoBox {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

const M_PER_DEG_LAT = 110_950;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);
/** A single region (or two very close ones) still shows a neighbourhood, not a street. */
const MIN_SPAN_M = 2_500;
const CHIP_H = 36;
const CHIP_GAP = 6;
const FRAME_MARGIN = 8;

const finite = (r: HeroRegionInput) => Number.isFinite(r.lat) && Number.isFinite(r.lng);

/** The regions the hero considers: the `max` busiest ones with coordinates. */
export function heroCandidates<T extends HeroRegionInput>(
  regions: readonly T[],
  max = HERO_CHIP_MAX,
): T[] {
  return regions
    .filter(finite)
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, max);
}

/** Bounding box of the given points (null when empty). */
export function geoBox(points: readonly LatLng[]): GeoBox | null {
  if (points.length === 0) return null;
  let swLat = Infinity;
  let swLng = Infinity;
  let neLat = -Infinity;
  let neLng = -Infinity;
  for (const p of points) {
    swLat = Math.min(swLat, p.lat);
    swLng = Math.min(swLng, p.lng);
    neLat = Math.max(neLat, p.lat);
    neLng = Math.max(neLng, p.lng);
  }
  return { swLat, swLng, neLat, neLng };
}

/** Metres per px that fit `box` into the frame minus `insets` (continuous). */
export function fitMetresPerPx(box: GeoBox, size: Size, insets: Insets): number {
  const midLat = (box.swLat + box.neLat) / 2;
  const spanX = Math.max((box.neLng - box.swLng) * mPerDegLng(midLat), MIN_SPAN_M);
  const spanY = Math.max((box.neLat - box.swLat) * M_PER_DEG_LAT, MIN_SPAN_M);
  const innerW = Math.max(1, size.width - insets.left - insets.right);
  const innerH = Math.max(1, size.height - insets.top - insets.bottom);
  return Math.max(spanX / innerW, spanY / innerH);
}

/**
 * Kakao level for `box`: the closest level whose scale fits (levels double the scale, so this
 * can show up to 2× more ground than needed). `tolerance` > 1 accepts a slightly closer level when
 * the box overshoots the insets by less than that factor (the edge chips are then checked one by
 * one and dropped when they leave the frame).
 */
export function fitKakaoLevel(box: GeoBox, size: Size, insets: Insets, tolerance = 1.1): number {
  const needed = fitMetresPerPx(box, size, insets) / tolerance;
  const level = Math.ceil(Math.log2(needed) + 3 - 1e-9);
  return Math.min(HERO_KAKAO_LEVEL.MAX, Math.max(HERO_KAKAO_LEVEL.MIN, level));
}

/**
 * Map centre that puts the centre of `box` at the centre of the inset area (insets are not
 * symmetric: the top bar takes more room than the bottom edge).
 */
export function fitCenter(box: GeoBox, insets: Insets, metresPerPx: number): LatLng {
  const lat = (box.swLat + box.neLat) / 2;
  const lng = (box.swLng + box.neLng) / 2;
  const ox = (insets.left - insets.right) / 2;
  const oy = (insets.top - insets.bottom) / 2;
  return {
    lat: lat + (oy * metresPerPx) / M_PER_DEG_LAT,
    lng: lng - (ox * metresPerPx) / mPerDegLng(lat),
  };
}

/** lat/lng → px of a frame of `size` centred on `center` at `metresPerPx` (x east, y south). */
export function projectToFrame(
  p: LatLng,
  center: LatLng,
  metresPerPx: number,
  size: Size,
): { x: number; y: number } {
  const midLat = (p.lat + center.lat) / 2;
  return {
    x: size.width / 2 + ((p.lng - center.lng) * mPerDegLng(midLat)) / metresPerPx,
    y: size.height / 2 - ((p.lat - center.lat) * M_PER_DEG_LAT) / metresPerPx,
  };
}

/** Rendered chip width estimate (13px bold name, count badge, 평당가 when highlighted). */
export function chipWidth(name: string, count: number, per: string | null): number {
  const countBadge = 16 + formatCount(count).length * 8.5;
  const perText = per ? 8 + per.length * 7.5 : 0;
  return 12 + name.length * 13.5 + 8 + countBadge + 6 + perText;
}

const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.x < b.x + b.width + gap &&
  b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap &&
  b.y < a.y + a.height + gap;

/** The region to highlight: the featured listing's 동 when it is a candidate, else the busiest. */
export function highlightCandidate(
  candidates: readonly HeroRegionInput[],
  featuredEmdName?: string | null,
): string | null {
  if (featuredEmdName) {
    const match = candidates.find(
      (r) => r.emdName === featuredEmdName || r.name === featuredEmdName,
    );
    if (match) return match.code;
  }
  return candidates[0]?.code ?? null;
}

interface PlaceOptions {
  size: Size;
  /** Region → px in the frame. */
  project: (p: LatLng) => { x: number; y: number };
  /** Areas covered by the frame's chrome (top bar, featured card, map copyright). */
  obstacles: readonly Rect[];
  onCode: string | null;
}

function place(candidates: readonly HeroRegionInput[], o: PlaceOptions): HeroRegionChip[] {
  const order = [...candidates].sort(
    (a, b) => Number(b.code === o.onCode) - Number(a.code === o.onCode),
  );
  const placed: { chip: HeroRegionChip; rect: Rect }[] = [];
  for (const r of order) {
    const p = o.project(r);
    const per =
      r.code === o.onCode && r.avgPricePerPyeong ? formatPerPyeong(r.avgPricePerPyeong) : null;
    const width = chipWidth(r.name, r.listingCount, per);
    const rect = { x: p.x - width / 2, y: p.y - CHIP_H / 2, width, height: CHIP_H };
    const inside =
      rect.x >= FRAME_MARGIN &&
      rect.y >= FRAME_MARGIN &&
      rect.x + rect.width <= o.size.width - FRAME_MARGIN &&
      rect.y + rect.height <= o.size.height - FRAME_MARGIN;
    if (!inside) continue;
    if (o.obstacles.some((ob) => overlaps(rect, ob, CHIP_GAP))) continue;
    if (placed.some((q) => overlaps(rect, q.rect, CHIP_GAP))) continue;
    placed.push({
      rect,
      chip: {
        code: r.code,
        name: r.name,
        count: r.listingCount,
        x: p.x,
        y: p.y,
        wideOnly: false,
        avgPricePerPyeong: r.avgPricePerPyeong ?? null,
        lat: r.lat,
        lng: r.lng,
      },
    });
  }
  // Busiest first (DOM / tab order); below the desktop layout only the top five stay.
  return placed
    .map((q) => q.chip)
    .sort((a, b) => b.count - a.count)
    .map((c, i) => ({ ...c, wideOnly: c.code !== o.onCode && i >= 5 }));
}

/** Places the chips, re-running once when the highlighted region itself did not fit. */
function placeWithHighlight(
  candidates: readonly HeroRegionInput[],
  featuredEmdName: string | null | undefined,
  o: Omit<PlaceOptions, 'onCode'>,
): HeroLayout {
  const want = highlightCandidate(candidates, featuredEmdName);
  let chips = place(candidates, { ...o, onCode: want });
  if (want && chips.some((c) => c.code === want)) return { chips, onCode: want };
  const busiest = chips[0]?.code ?? null;
  if (busiest) chips = place(candidates, { ...o, onCode: busiest });
  return { chips, onCode: chips.some((c) => c.code === busiest) ? busiest : null };
}

/** Frame chrome of the static fallback, in px of the virtual frame. */
export function staticObstacles(hasCard: boolean): Rect[] {
  return hasCard ? [HERO_STATIC_TOP_BAR, HERO_STATIC_CARD] : [HERO_STATIC_TOP_BAR];
}

/** Insets that keep the fitted regions above `card` (the featured listing card). */
export function insetsAbove(insets: Insets, card: Rect | null | undefined, size: Size): Insets {
  if (!card) return insets;
  return {
    ...insets,
    bottom: Math.max(insets.bottom, size.height - card.y + CHIP_H / 2 + CHIP_GAP),
  };
}

interface Candidate {
  insets: Insets;
  metresPerPx: number;
  level?: number;
}

/**
 * Tries each fit (scale × insets) and keeps the one that shows the most chips — the busy core of
 * the city is small, so a slightly farther view often fits more chips than the tightest fit. Ties
 * go to the earlier (closer) candidate.
 */
function bestLayout(
  regions: readonly HeroRegionInput[],
  box: GeoBox,
  fits: readonly Candidate[],
  o: { size: Size; obstacles: readonly Rect[]; featuredEmdName?: string | null },
): (HeroLayout & { center: LatLng; fit: Candidate }) | null {
  let best: (HeroLayout & { center: LatLng; fit: Candidate }) | null = null;
  for (const fit of fits) {
    const center = fitCenter(box, fit.insets, fit.metresPerPx);
    const layout = placeWithHighlight(regions, o.featuredEmdName, {
      size: o.size,
      project: (p) => projectToFrame(p, center, fit.metresPerPx, o.size),
      obstacles: o.obstacles,
    });
    if (!best || layout.chips.length > best.chips.length) best = { ...layout, center, fit };
  }
  return best;
}

/**
 * Static fallback layout (server-rendered): chips at their real relative positions on the
 * virtual frame, returned in % of it.
 */
export function staticHeroLayout(
  regions: readonly HeroRegionInput[],
  options: { featuredEmdName?: string | null; hasCard?: boolean } = {},
): HeroLayout {
  const candidates = heroCandidates(regions);
  const box = geoBox(candidates);
  if (!box) return { chips: [], onCode: null };
  const size = HERO_MAP_FRAME;
  const hasCard = options.hasCard ?? false;
  const insetOptions = hasCard
    ? [HERO_STATIC_INSETS, insetsAbove(HERO_STATIC_INSETS, HERO_STATIC_CARD, size)]
    : [HERO_STATIC_INSETS];
  const fits = insetOptions.flatMap((insets) => {
    const mpp = fitMetresPerPx(box, size, insets);
    return [1, 1.25, 1.5].map((k) => ({ insets, metresPerPx: mpp * k }));
  });
  const layout = bestLayout(candidates, box, fits, {
    size,
    obstacles: staticObstacles(hasCard),
    featuredEmdName: options.featuredEmdName,
  });
  if (!layout) return { chips: [], onCode: null };
  const pct = (n: number, of: number) => Math.round((n / of) * 10_000) / 100;
  return {
    onCode: layout.onCode,
    chips: layout.chips.map((c) => ({ ...c, x: pct(c.x, size.width), y: pct(c.y, size.height) })),
  };
}

export interface KakaoHeroLayout extends HeroLayout {
  center: LatLng;
  level: number;
}

/**
 * Kakao map layout for a measured frame: the centre + level that show the most chips — the
 * level that fits all regions, or one step closer / farther (Kakao levels double the scale, so the
 * fitted one can be much too far or crop only the outskirts), centred on the whole frame or on the
 * part above the featured card — and the chips at their px positions.
 */
export function kakaoHeroLayout(
  regions: readonly HeroRegionInput[],
  options: {
    size: Size;
    insets: Insets;
    /** Top bar, featured card, map copyright — chips must stay clear of them. */
    obstacles: readonly Rect[];
    /** The featured card (also in `obstacles`): a fit above it is tried as well. */
    card?: Rect | null;
    featuredEmdName?: string | null;
  },
): KakaoHeroLayout | null {
  const { size } = options;
  if (size.width <= 0 || size.height <= 0) return null;
  const candidates = heroCandidates(regions);
  const box = geoBox(candidates);
  // No listings yet (e.g. right after launch): still show the real city, without chips.
  if (!box)
    return {
      chips: [],
      onCode: null,
      center: { ...DEFAULT_MAP_CENTER },
      level: HERO_KAKAO_LEVEL.EMPTY,
    };
  const insetOptions = options.card
    ? [options.insets, insetsAbove(options.insets, options.card, size)]
    : [options.insets];
  const fits = insetOptions.flatMap((insets) => {
    const level = fitKakaoLevel(box, size, insets);
    const levels = [level, level - 1, level + 1].filter(
      (l) => l >= HERO_KAKAO_LEVEL.MIN && l <= HERO_KAKAO_LEVEL.MAX,
    );
    return [...new Set(levels)].map((l) => ({
      insets,
      level: l,
      metresPerPx: kakaoMetresPerPx(l),
    }));
  });
  const layout = bestLayout(candidates, box, fits, {
    size,
    obstacles: options.obstacles,
    featuredEmdName: options.featuredEmdName,
  });
  if (!layout) return null;
  return {
    chips: layout.chips,
    onCode: layout.onCode,
    center: layout.center,
    level: layout.fit.level ?? HERO_KAKAO_LEVEL.MAX,
  };
}
