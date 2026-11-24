/** Deterministic fake UUID from a short fixture id — same algorithm as apps/web `mockUuid`. */
export function mockUuid(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
}

let seq = 0;
/** Fresh UUID-shaped id for rows created during a mock session. */
export function newId(): string {
  seq += 1;
  const time = Date.now().toString(16).padStart(12, '0').slice(-12);
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `${time.slice(0, 8)}-${time.slice(8)}-7000-8000-${rand}${seq.toString(16).padStart(8, '0')}`;
}

/** Reference "now" of the fixtures (mockdata.md: 2026-11-23). New rows use the real clock. */
export const FIXTURE_NOW = '2026-11-23T14:20:00+09:00';
export const nowIso = () => new Date().toISOString();
