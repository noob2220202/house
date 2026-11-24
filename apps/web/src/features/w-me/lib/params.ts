/** `?page=` → positive integer (1 when missing or malformed, capped to keep URLs sane). */
export function parsePageParam(value: string | string[] | undefined, max = 500): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,4}$/.test(raw)) return 1;
  return Math.min(max, Math.max(1, Number(raw)));
}
