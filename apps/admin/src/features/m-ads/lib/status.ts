import { BannerStatus, computeScheduleStatus } from '@house/shared';
import type { StatusTone } from '@house/ui';
import { dayDiff, formatDayFull, formatDayShort, kstToday, toKstDay } from './dates';

/** Schedule fields every banner / popup has. Status is computed from them, never stored. */
export interface Schedule {
  paused: boolean;
  startAt: string;
  endAt: string;
}

export const STATUS_LABEL: Record<BannerStatus, string> = {
  ACTIVE: '노출',
  PAUSED: '중지',
  SCHEDULED: '예약',
  ENDED: '종료',
};

/** Pill wording used in headers (design: 게시중 / 예약). */
export const STATUS_PILL_LABEL: Record<BannerStatus, string> = {
  ACTIVE: '게시중',
  PAUSED: '중지',
  SCHEDULED: '예약',
  ENDED: '종료',
};

export const STATUS_TONE: Record<BannerStatus, StatusTone> = {
  ACTIVE: 'live',
  PAUSED: 'ended',
  SCHEDULED: 'scheduled',
  ENDED: 'ended',
};

export const STATUS_FILTER_OPTIONS: readonly { value: BannerStatus; label: string }[] = [
  { value: BannerStatus.ACTIVE, label: '노출' },
  { value: BannerStatus.SCHEDULED, label: '예약' },
  { value: BannerStatus.PAUSED, label: '중지' },
  { value: BannerStatus.ENDED, label: '종료' },
];

/** Same rule as the backend (`computeScheduleStatus`), for ISO strings. */
export function scheduleStatus(item: Schedule, now: Date = new Date()): BannerStatus {
  const startAt = new Date(item.startAt);
  const endAt = new Date(item.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()))
    return item.paused ? BannerStatus.PAUSED : BannerStatus.SCHEDULED;
  return computeScheduleStatus({ paused: item.paused, startAt, endAt }, now);
}

/** Second line under the status toggle: "7일 남음" · "12.01 시작" · pause reason · "11.20 종료". */
export function statusCaption(
  item: Schedule & { memo?: string | null },
  now: Date = new Date(),
): string {
  const status = scheduleStatus(item, now);
  const today = kstToday(now);
  if (status === BannerStatus.ACTIVE) {
    const left = dayDiff(today, toKstDay(item.endAt));
    return left <= 0 ? '오늘 종료' : `${left}일 남음`;
  }
  if (status === BannerStatus.SCHEDULED) return `${formatDayShort(toKstDay(item.startAt))} 시작`;
  if (status === BannerStatus.PAUSED) return item.memo?.trim() || '일시 중지';
  return `${formatDayShort(toKstDay(item.endAt))} 종료`;
}

/** Hint next to the status control of the editor: what happens automatically. */
export function scheduleHint(item: Schedule, now: Date = new Date()): string {
  const status = scheduleStatus(item, now);
  if (status === BannerStatus.SCHEDULED)
    return `${formatDayFull(toKstDay(item.startAt))} 00:00 자동 노출`;
  if (status === BannerStatus.ACTIVE)
    return `${formatDayFull(toKstDay(item.endAt))} 23:59 자동 종료`;
  if (status === BannerStatus.PAUSED) return '중지 중에는 노출되지 않아요';
  return '기간이 끝났어요 · 종료일을 늘리면 다시 노출돼요';
}

/** Click-through rate as a ratio (0 when there are no impressions). */
export function ctrOf(impressions: number, clicks: number): number {
  return impressions > 0 ? clicks / impressions : 0;
}

/** Display id: the backend `code` when present, otherwise a short form of the UUID. */
export function displayCode(item: { id: string; code?: string | null }): string {
  return item.code?.trim() || `#${item.id.slice(0, 8).toUpperCase()}`;
}
