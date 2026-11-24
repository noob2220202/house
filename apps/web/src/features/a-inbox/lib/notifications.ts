import { NotificationType } from '@house/shared';
import { notificationHref } from '@/features/w-me/lib/notifications';
import type { Notification } from '@/features/w-me/schemas';
import { INBOX_ROUTES } from '../routes';

function str(data: Notification['data'], key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** A notification addressed to the user as a member of an agency (payload carries `agencyId`). */
export function isAgencyNotification(n: Pick<Notification, 'data'>): boolean {
  return str(n.data, 'agencyId') !== null;
}

/**
 * Where a notification leads inside the broker console.
 *
 * Agents are ordinary users too, so the same feed (`GET /me/notifications`) mixes agency events
 * (a request arrived, our proposal was accepted, a contact was opened to us) with personal ones
 * (their own 내놓기·구하기). Agency events carry `data.agencyId` and open console pages; everything
 * else falls back to the my-page deep links.
 */
export function agentNotificationHref(n: Pick<Notification, 'type' | 'data'>): string | null {
  if (isAgencyNotification(n)) {
    const dealRequestId = str(n.data, 'dealRequestId');
    const inquiryId = str(n.data, 'inquiryId');
    switch (n.type) {
      case NotificationType.DEAL_REQUEST_RECEIVED:
      case NotificationType.PROPOSAL_ACCEPTED:
      case NotificationType.CONTACT_GRANTED:
      case NotificationType.PROPOSAL_RECEIVED:
        return dealRequestId ? INBOX_ROUTES.request(dealRequestId) : INBOX_ROUTES.requests;
      default:
        if (inquiryId) return INBOX_ROUTES.inquiry(inquiryId);
        if (dealRequestId) return INBOX_ROUTES.request(dealRequestId);
    }
  }
  return notificationHref(n);
}
