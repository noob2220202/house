import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequestsView } from '@/features/a-inbox/requests/RequestsView';
import { INBOX_ROUTES } from '@/features/a-inbox/routes';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '내놓기·구하기 요청' };

/** /agent/requests — 내놓기·구하기 requests that reach the agency (filters live in the URL). */
export default async function AgentRequestsPage() {
  await requireAgent(INBOX_ROUTES.requests);
  return (
    <Suspense fallback={null}>
      <RequestsView />
    </Suspense>
  );
}
