import { UserRole } from '@house/shared';
import type { Metadata } from 'next';
import { CoBrokerView } from '@/features/a-listings/cobroker/CoBrokerView';
import { CO_BROKER_ROUTE } from '@/features/a-listings/routes';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '공동중개 매물 찾기' };

/** /agent/listings/co-broker — join another office's listing as a co-broker. */
export default async function AgentCoBrokerPage() {
  const user = await requireAgent(CO_BROKER_ROUTE);
  return <CoBrokerView isOwner={user.role === UserRole.AGENCY_OWNER} />;
}
