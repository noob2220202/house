import { createHash } from 'node:crypto';

/**
 * Deterministic UUID for seed rows (`seedId('listing', 17)`), so every seed run upserts the same
 * rows instead of creating duplicates. Formatted as an RFC 4122 v5-style id (version nibble 5).
 */
export function seedId(kind: string, key: string | number): string {
  const h = createHash('sha256').update(`house-seed:${kind}:${key}`).digest('hex');
  const variant = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Small deterministic PRNG (mulberry32) so the demo data is the same on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = ReturnType<typeof rng>;

export const pick = <T>(r: Rand, items: readonly T[]): T => {
  const item = items[Math.floor(r() * items.length)];
  if (item === undefined) throw new Error('pick from empty list');
  return item;
};

export const intBetween = (r: Rand, min: number, max: number): number =>
  min + Math.floor(r() * (max - min + 1));

/** Rounds 만원 amounts to a realistic step (e.g. 100만원 for 매매가). */
export const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

/** Small random offset in degrees (~ up to `meters` m) around a point. */
export function jitter(
  r: Rand,
  lat: number,
  lng: number,
  meters: number,
): { lat: number; lng: number } {
  const dLat = ((r() * 2 - 1) * meters) / 111_000;
  const dLng = ((r() * 2 - 1) * meters) / (111_000 * Math.cos((lat * Math.PI) / 180));
  return { lat: Number((lat + dLat).toFixed(6)), lng: Number((lng + dLng).toFixed(6)) };
}

export const daysAgo = (now: Date, days: number): Date =>
  new Date(now.getTime() - days * 86_400_000);

/** UTC midnight of a calendar date (Prisma @db.Date columns). */
export const dateOnly = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d));
