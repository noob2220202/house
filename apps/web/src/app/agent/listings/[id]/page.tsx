import { redirect } from 'next/navigation';
import { AGENT_ROUTES } from '@/features/a-agency/nav';

type Props = { params: Promise<{ id: string }> };

/** /agent/listings/:id has no page of its own — the editor is the detail view. */
export default async function AgentListingPage({ params }: Props) {
  const { id } = await params;
  redirect(AGENT_ROUTES.listingEdit(id));
}
