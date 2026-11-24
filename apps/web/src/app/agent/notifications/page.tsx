import type { Metadata } from 'next';
import { agencyDealRequestPageSchema, inquiryPageSchema } from '@/features/a-inbox/api/schemas';
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

/** Inbox counters for the tiles above the feed (cheapest list calls: one row each). */
async function loadSummary(): Promise<InboxSummary> {
  const query = { page: 1, pageSize: 1 };
  const [requests, inquiries] = await Promise.all([
    orNull(
      serverGetAuthed('/agency/deal-requests', { query, schema: agencyDealRequestPageSchema }),
    ),
    orNull(serverGetAuthed('/agency/inquiries', { query, schema: inquiryPageSchema })),
  ]);
  return {
    newRequests: requests?.stageCounts?.NEW ?? null,
    waitingProposals: requests?.stageCounts?.PROPOSED ?? null,
    unreadInquiries: inquiries?.unreadCount ?? null,
  };
}

/** /agent/notifications — notification centre of the console. */
export default async function AgentNotificationsPage() {
  await requireAgent(INBOX_ROUTES.notifications);
  return <AgentNotificationsView summary={await loadSummary()} />;
}
