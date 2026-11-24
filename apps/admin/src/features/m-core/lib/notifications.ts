import type { IconName } from '@house/ui';
import { safeReturnTo } from '@/lib/auth/routes';
import { toKstDateString, type DateInput } from '@/lib/format';
import type { AdminNotification, AdminNotificationKind } from '../api/schemas';
import { kstDaysBetween } from './dashboard';

export const NOTIFICATION_KIND_META: Record<
  AdminNotificationKind,
  { label: string; icon: IconName; tone: 'brand' | 'accent' | 'danger' | 'neutral' }
> = {
  AGENCY_APPLIED: { label: '중개사 승인', icon: 'store', tone: 'accent' },
  LISTING_REVIEW: { label: '매물 검수', icon: 'building', tone: 'brand' },
  REPORT_RECEIVED: { label: '신고', icon: 'siren', tone: 'danger' },
  DEAL_REQUEST_UNASSIGNED: { label: '내놓기·구하기', icon: 'home-up', tone: 'brand' },
  AD_EXPIRING: { label: '광고', icon: 'megaphone', tone: 'accent' },
  SECURITY: { label: '보안', icon: 'shield', tone: 'danger' },
  SYSTEM: { label: '시스템', icon: 'info', tone: 'neutral' },
};

export interface NotificationGroup {
  key: string;
  label: string;
  items: AdminNotification[];
}

/** Groups a newest-first feed under 오늘 / 어제 / 이번 주 / 이전 (KST calendar days). */
export function groupNotifications(
  items: readonly AdminNotification[],
  now: DateInput = new Date(),
): NotificationGroup[] {
  const buckets: NotificationGroup[] = [
    { key: 'today', label: '오늘', items: [] },
    { key: 'yesterday', label: '어제', items: [] },
    { key: 'week', label: '최근 7일', items: [] },
    { key: 'older', label: '이전', items: [] },
  ];
  for (const item of items) {
    const days = kstDaysBetween(item.createdAt, now);
    const bucket = days <= 0 ? 0 : days === 1 ? 1 : days < 7 ? 2 : 3;
    buckets[bucket]!.items.push(item);
  }
  return buckets.filter((b) => b.items.length > 0);
}

/**
 * Only site-relative back-office paths are followed from a notification. Same rule as the login
 * `returnTo` (also rejects control characters: the URL parser drops tabs / newlines, so
 * "/\t/evil.example" would otherwise become the protocol-relative "//evil.example").
 */
export function safeNotificationLink(link: string | null | undefined): string | null {
  const safe = safeReturnTo(link, '');
  return safe || null;
}

/** Stable day key (YYYY-MM-DD, KST) — handy for list keys. */
export const dayKey = (input: DateInput) => toKstDateString(input);
