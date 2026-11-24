import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InquiriesView } from '@/features/a-inbox/inquiries/InquiriesView';
import { INBOX_ROUTES } from '@/features/a-inbox/routes';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '문의' };

/** /agent/inquiries — messages and contact log of the office (`?id=` opens one inquiry). */
export default async function AgentInquiriesPage() {
  await requireAgent(INBOX_ROUTES.inquiries);
  return (
    <Suspense fallback={null}>
      <InquiriesView />
    </Suspense>
  );
}
