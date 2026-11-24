import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { inboxKeys } from '@/features/a-inbox/api/queries';
import { agencyDealRequestDetailSchema } from '@/features/a-inbox/api/schemas';
import { RequestDetailView } from '@/features/a-inbox/requests/RequestDetailView';
import { INBOX_ROUTES } from '@/features/a-inbox/routes';
import { serverGetAuthed } from '@/lib/api/server';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '요청 상세' };

/**
 * /agent/requests/[id] — request detail, requester contact (after consent) and our proposal.
 *
 * The request is fetched on the server and seeded into the client cache, so the page paints with
 * its content instead of a skeleton (no layout shift when it arrives). A failed fetch (404 = not
 * this agency's request, 5xx) is not dehydrated: the client view requests it again and shows its
 * own not-found / retry state.
 */
export default async function AgentRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAgent(INBOX_ROUTES.request(id));

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: inboxKeys.request(id),
    queryFn: () =>
      serverGetAuthed(`/agency/deal-requests/${encodeURIComponent(id)}`, {
        schema: agencyDealRequestDetailSchema,
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RequestDetailView id={id} memberName={user.name || user.nickname} />
    </HydrationBoundary>
  );
}
