import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InquiriesView } from '@/features/a-inbox/inquiries/InquiriesView';
import { INBOX_ROUTES } from '@/features/a-inbox/routes';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '문의함' };

/**
 * /agent/inquiries — the office's 문의함: written inquiries and logged contact events, with
 * replies, handling status and memo (`?id=` opens one inquiry; filters live in the URL).
 */
export default async function AgentInquiriesPage() {
  await requireAgent(INBOX_ROUTES.inquiries);
  return (
    <Suspense fallback={null}>
      <InquiriesView />
    </Suspense>
  );
}
