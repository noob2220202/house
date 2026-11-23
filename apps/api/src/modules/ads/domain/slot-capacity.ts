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
