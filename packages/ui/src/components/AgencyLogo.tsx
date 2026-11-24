import type { CSSProperties, ReactNode } from 'react';
import styles from './AgencyLogo.module.css';
import { cx } from '../lib/cx';
import { PhotoPlaceholder } from './PhotoPlaceholder';

/** `art` = the office illustration; the others are tinted initials. */
export type AgencyLogoTone = 'art' | 'brand' | 'accent' | 'grey';
export type AgencyLogoFallback = 'auto' | 'initials' | 'art';

export interface AgencyLogoProps {
  /** 중개사무소 명칭 — the initials come from it. */
  name: string;
  /** Stable id of the office (agency id). Picks the fallback look, so an office looks the same everywhere. */
  seed: string;
  /** The uploaded logo, e.g. `<Image src={logoUrl} alt="" fill sizes="56px" />`. */
  image?: ReactNode;
  /** px (width = height). Default 56. */
  size?: number;
  shape?: 'square' | 'round';
  /** `auto` = initials or illustration chosen from `seed`; `initials` / `art` force one. */
  fallback?: AgencyLogoFallback;
  /** Initials to show. Default: 1 below 64px, 2 from 64px. */
  maxInitials?: number;
  /** Accessible name. Without it the logo is decorative (the office name is next to it). */
  label?: string;
  className?: string;
}

const TONES: readonly AgencyLogoTone[] = ['art', 'brand', 'accent', 'grey'];
const INITIAL_TONES: readonly AgencyLogoTone[] = ['brand', 'accent', 'grey'];

function hashSeed(seed: string): number {
  // FNV-1a with a final mix: seeds that differ by one character still spread over the tones.
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * The fallback look of an office logo, derived only from `seed` (same office → same look on every
 * page). With `initials`, an office whose `auto` look is the illustration gets a stable tint instead;
 * all other offices keep the tint they have under `auto`.
 */
export function agencyLogoTone(
  seed: string,
  fallback: AgencyLogoFallback = 'auto',
): AgencyLogoTone {
  if (fallback === 'art') return 'art';
  const h = hashSeed(seed);
  const tone = TONES[h % TONES.length] ?? 'brand';
  if (fallback === 'auto' || tone !== 'art') return tone;
  return INITIAL_TONES[Math.floor(h / TONES.length) % INITIAL_TONES.length] ?? 'brand';
}

const NAME_PREFIX = /^\s*(\(주\)|㈜|주식회사|\(유\)|유한회사)\s*/;
const NAME_SUFFIX =
  /\s*(공인중개사\s*사무소|부동산\s*중개\s*법인|부동산\s*중개|공인중개사|중개사무소|중개법인|부동산)\s*$/;

/**
 * Initials for an office avatar: "호수공원 공인중개사사무소" → "호수" (max 2), "(주)신대부동산" → "신대".
 * Company prefixes and 중개사무소-type suffixes are dropped; falls back to the full name.
 */
export function agencyInitials(name: string, max = 2): string {
  const trimmed = name.trim();
  const short = trimmed.replace(NAME_PREFIX, '').replace(NAME_SUFFIX, '').trim() || trimmed;
  return Array.from(short.replace(/\s+/g, '')).slice(0, Math.max(1, max)).join('');
}

function radiusFor(size: number): string {
  if (size <= 36) return 'var(--r-sm)';
  if (size <= 60) return 'var(--r-md)';
  if (size <= 76) return '20px';
  return 'var(--r-xl)';
}

/** Office logo: the uploaded image, or a deterministic fallback (tinted initials or the office art). */
export function AgencyLogo({
  name,
  seed,
  image,
  size = 56,
  shape = 'square',
  fallback = 'auto',
  maxInitials,
  label,
  className,
}: AgencyLogoProps) {
  const tone = image ? null : agencyLogoTone(seed, fallback);
  const count = maxInitials ?? (size >= 64 ? 2 : 1);
  const initials = tone && tone !== 'art' ? agencyInitials(name, count) : '';
  const fontSize = Math.max(12, Math.round(size * (Array.from(initials).length > 1 ? 0.3 : 0.39)));
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: shape === 'round' ? '50%' : radiusFor(size),
    fontSize,
  };
  return (
    <span
      className={cx(styles.logo, tone && styles[tone], className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-tone={tone ?? 'image'}
    >
      {image ?? (tone === 'art' ? <PhotoPlaceholder kind="office" /> : initials)}
    </span>
  );
}
