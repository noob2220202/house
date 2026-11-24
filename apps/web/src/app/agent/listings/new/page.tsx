import type { Metadata } from 'next';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ListingWizard } from '@/features/a-listings/wizard/ListingWizard';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '매물 등록' };

/** /agent/listings/new — listing wizard (creates a DRAFT on the first save). */
export default async function AgentListingNewPage() {
  await requireAgent(AGENT_ROUTES.listingNew);
  return <ListingWizard />;
}
