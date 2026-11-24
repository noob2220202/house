import type { Metadata } from 'next';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ProfileView } from '@/features/a-agency/profile/ProfileView';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '사무소 프로필' };

export default async function AgentProfilePage() {
  await requireAgent(AGENT_ROUTES.profile);
  return <ProfileView />;
}
