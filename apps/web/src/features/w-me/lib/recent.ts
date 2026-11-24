import { toKstDateString } from '@/lib/format';

export type RecentBucketKey = 'today' | 'yesterday' | 'week' | 'earlier';

export const RECENT_BUCKET_LABEL: Record<RecentBucketKey, string> = {
  today: '오늘',
  yesterday: '어제',
  week: '이번 주',
  earlier: '지난 기록',
};

const ORDER: readonly RecentBucketKey[] = ['today', 'yesterday', 'week', 'earlier'];

/** Whole calendar days (Asia/Seoul) between two instants; 0 = same day, 1 = yesterday. */
export function kstDaysAgo(viewedAt: string | Date, now: Date = new Date()): number {
  const day = (d: string | Date) => Date.parse(`${toKstDateString(d)}T00:00:00+09:00`);
  const diff = Math.round((day(now) - day(viewedAt)) / 86_400_000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

export function recentBucketOf(viewedAt: string | Date, now: Date = new Date()): RecentBucketKey {
  const days = kstDaysAgo(viewedAt, now);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'earlier';
}

export interface RecentGroup<T> {
  key: RecentBucketKey;
  label: string;
  items: T[];
}

/**
 * Groups recently viewed items by day bucket (오늘 / 어제 / 이번 주 / 지난 기록), keeping the
 * incoming order inside each bucket and dropping empty buckets.
 */
export function groupRecentViews<T extends { viewedAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): RecentGroup<T>[] {
  const map = new Map<RecentBucketKey, T[]>();
  for (const item of items) {
    const key = recentBucketOf(item.viewedAt, now);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return ORDER.flatMap((key) => {
    const list = map.get(key);
    return list ? [{ key, label: RECENT_BUCKET_LABEL[key], items: list }] : [];
  });
}
