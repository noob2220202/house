import type { Metadata } from 'next';
import {
  inboxNewCountSchema,
  proposalTotalSchema,
  WAITING_PROPOSALS_QUERY,
} from '@/features/a-inbox/api/schemas';
import {
  AgentNotificationsView,
  type InboxSummary,
} from '@/features/a-inbox/notifications/AgentNotificationsView';
import { INBOX_ROUTES } from '@/features/a-inbox/routes';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '알림' };

/** Null instead of an error: the counters are a convenience, the feed must still render. */
async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/**
 * Inbox counters for the tiles above the feed: 새 요청 and 안 읽은 문의 from the console dashboard
 * aggregate, 응답 대기 = total of our SENT / VIEWED proposals (one-row page).
 */
async function loadSummary(): Promise<InboxSummary> {
  const [dashboard, waiting] = await Promise.all([
    orNull(serverGetAuthed('/agencies/mine/dashboard', { schema: inboxNewCountSchema })),
    orNull(
      serverGetAuthed('/agency/proposals', {
        query: WAITING_PROPOSALS_QUERY,
        schema: proposalTotalSchema,
      }),
    ),
  ]);
  return {
    newRequests: dashboard?.dealRequests.newCount ?? null,
    waitingProposals: waiting?.total ?? null,
    unreadInquiries: dashboard?.inquiries?.unreadCount ?? null,
  };
}

/** /agent/notifications — notification centre of the console. */
export default async function AgentNotificationsPage() {
  await requireAgent(INBOX_ROUTES.notifications);
  return <AgentNotificationsView summary={await loadSummary()} />;
}
