import type { Metadata } from 'next';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ListingWizard } from '@/features/a-listings/wizard/ListingWizard';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '매물 수정' };

type Props = { params: Promise<{ id: string }> };

/** /agent/listings/:id/edit — the wizard on an existing listing (`?step=` opens a step). */
export default async function AgentListingEditPage({ params }: Props) {
  const { id } = await params;
  await requireAgent(AGENT_ROUTES.listingEdit(id));
  return <ListingWizard key={id} listingId={id} />;
}
