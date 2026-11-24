import { NotificationType } from '@house/shared';
import type { IconName } from '@house/ui';
import { ROUTES } from '@/config/nav';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { INBOX_ROUTES } from '@/features/a-inbox/routes';
import { safeReturnTo } from '@/lib/auth/paths';
import type { Notification } from '../schemas';

export type NotificationTone = 'brand' | 'success' | 'warn' | 'danger' | 'neutral';

export interface NotificationMeta {
  /** Category caption shown above the title. */
  label: string;
  icon: IconName;
  tone: NotificationTone;
}

/**
 * Category meta per type. The deal-request types follow the backend enum semantics
 * (`deal-requests` README): DEAL_REQUEST_RECEIVED / PROPOSAL_ACCEPTED / CONTACT_GRANTED are sent to
 * the members of an AGENCY (a request arrived, our proposal was accepted, the requester opened
 * their contact to us); PROPOSAL_RECEIVED is the only one sent to the REQUESTER.
 * LISTING_EXPIRED / CO_BROKER_REQUESTED come from the `listings` module and go to the OWNERS of the
 * listing's primary agency with `data.listingId` (광고기간 만료, 다른 사무소의 공동중개 참여 요청).
 */
export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  DEAL_REQUEST_RECEIVED: { label: '새 요청 도착', icon: 'home-up', tone: 'brand' },
  PROPOSAL_RECEIVED: { label: '제안 도착', icon: 'chat', tone: 'brand' },
  PROPOSAL_ACCEPTED: { label: '제안 수락됨', icon: 'check-circle', tone: 'success' },
  CONTACT_GRANTED: { label: '연락처 공개됨', icon: 'phone', tone: 'success' },
  AGENCY_APPROVED: { label: '중개사 회원', icon: 'store', tone: 'success' },
  AGENCY_REJECTED: { label: '중개사 회원', icon: 'store', tone: 'danger' },
  AGENCY_WARNED: { label: '운영 안내', icon: 'siren', tone: 'warn' },
  LISTING_HIDDEN: { label: '매물 안내', icon: 'building', tone: 'warn' },
  REPORT_RESOLVED: { label: '신고 처리', icon: 'shield', tone: 'success' },
  LISTING_EXPIRED: { label: '광고기간 만료', icon: 'clock', tone: 'warn' },
  CO_BROKER_REQUESTED: { label: '공동중개 요청', icon: 'link', tone: 'brand' },
  SYSTEM: { label: '알림', icon: 'megaphone', tone: 'neutral' },
};

const INQUIRY_META: NotificationMeta = { label: '매물 문의', icon: 'chat', tone: 'brand' };

function str(data: Notification['data'], key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Category meta of a notification. Pass `data` when you have it: a SYSTEM row that carries an
 * `inquiryId` (매물 문의 sent to an agency) gets its own caption.
 */
export function notificationMeta(
  type: NotificationType,
  data?: Notification['data'],
): NotificationMeta {
  if (type === NotificationType.SYSTEM && str(data, 'inquiryId')) return INQUIRY_META;
  return NOTIFICATION_META[type] ?? NOTIFICATION_META.SYSTEM;
}

/** Types the backend only sends to the members of an agency (see NOTIFICATION_META). */
const AGENCY_ONLY_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.DEAL_REQUEST_RECEIVED,
  NotificationType.PROPOSAL_ACCEPTED,
  NotificationType.CONTACT_GRANTED,
  NotificationType.LISTING_EXPIRED,
  NotificationType.CO_BROKER_REQUESTED,
]);

/**
 * A notification addressed to the user as a member of an agency: the payload carries `agencyId`
 * (explicit discriminator), or the type is one that only agencies receive.
 *
 * `GET /me/notifications` is ONE feed per user and brokers are ordinary users too, so the my-page
 * list, the overview panel and the console all have to tell the two audiences apart from the row
 * itself — never from the page they are rendered on.
 */
export function isAgencyNotification(n: Pick<Notification, 'type' | 'data'>): boolean {
  return str(n.data, 'agencyId') !== null || AGENCY_ONLY_TYPES.has(n.type);
}

/** `data.url`, only when it is a site-relative path. */
function safeUrl(data: Notification['data']): string | null {
  const url = str(data, 'url');
  return url ? safeReturnTo(url, '') || null : null;
}

/** Console destination of an agency event, or null when the type decides (승인, 경고 …). */
function agencyHref(n: Pick<Notification, 'type' | 'data'>): string | null {
  const dealRequestId = str(n.data, 'dealRequestId');
  const inquiryId = str(n.data, 'inquiryId');
  const listingId = str(n.data, 'listingId');
  switch (n.type) {
    case NotificationType.LISTING_EXPIRED:
    case NotificationType.CO_BROKER_REQUESTED:
      // The console has no listing detail page of its own: the editor is the detail view.
      return listingId ? AGENT_ROUTES.listingEdit(listingId) : AGENT_ROUTES.listings;
    case NotificationType.DEAL_REQUEST_RECEIVED:
    case NotificationType.PROPOSAL_RECEIVED:
    case NotificationType.PROPOSAL_ACCEPTED:
    case NotificationType.CONTACT_GRANTED:
      return dealRequestId ? INBOX_ROUTES.request(dealRequestId) : INBOX_ROUTES.requests;
    case NotificationType.AGENCY_APPROVED:
    case NotificationType.AGENCY_REJECTED:
    case NotificationType.AGENCY_WARNED:
      return null;
    default:
      if (inquiryId) return INBOX_ROUTES.inquiry(inquiryId);
      if (dealRequestId) return INBOX_ROUTES.request(dealRequestId);
      return safeUrl(n.data);
  }
}

/**
 * Where a notification leads. Built from `type` + the deep-link payload in `data`; returns null
 * when there is nothing to open. Agency events (see `isAgencyNotification`) open the broker console
 * (`/agent/requests/{id}`, `/agent/inquiries?id=`), everything else the my-page / public pages.
 * `data.url` is only followed when it is a site-relative path.
 */
export function notificationHref(n: Pick<Notification, 'type' | 'data'>): string | null {
  if (isAgencyNotification(n)) {
    const href = agencyHref(n);
    if (href) return href;
  }
  const dealRequestId = str(n.data, 'dealRequestId');
  const listingId = str(n.data, 'listingId');
  const complexId = str(n.data, 'complexId');
  const myRequest = dealRequestId
    ? `${ROUTES.myRequests}/${encodeURIComponent(dealRequestId)}`
    : null;
  switch (n.type) {
    case NotificationType.PROPOSAL_RECEIVED:
      return myRequest ?? ROUTES.myRequests;
    case NotificationType.AGENCY_APPROVED:
    case NotificationType.AGENCY_WARNED:
      return ROUTES.agent;
    case NotificationType.AGENCY_REJECTED:
      return ROUTES.agentApply;
    case NotificationType.LISTING_HIDDEN:
      return listingId ? ROUTES.listing(listingId) : null;
    case NotificationType.REPORT_RESOLVED:
      return null;
    default: {
      const url = safeUrl(n.data);
      if (url) return url;
      // A SYSTEM row about the user's own 내놓기·구하기 request (e.g. "요청이 전달됐어요").
      if (myRequest) return myRequest;
      if (complexId) return ROUTES.complex(complexId);
      if (listingId) return ROUTES.listing(listingId);
      return null;
    }
  }
}

export function isUnread(n: Pick<Notification, 'readAt'>): boolean {
  return !n.readAt;
}

/** Badge text for an unread counter: 0 → null, 1…99 → "N", 100+ → "99+". */
export function unreadBadge(count: number | null | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}
