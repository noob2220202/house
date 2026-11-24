import { UserRole } from '@house/shared';
import type { Metadata } from 'next';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ListingsView } from '@/features/a-listings/list/ListingsView';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '매물 관리' };

/** /agent/listings — listings of the caller's agency (own + co-brokered). */
export default async function AgentListingsPage() {
  const user = await requireAgent(AGENT_ROUTES.listings);
  return <ListingsView isOwner={user.role === UserRole.AGENCY_OWNER} />;
}
