import type { Metadata } from 'next';
import { DashboardView } from '@/features/a-agency/dashboard/DashboardView';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '대시보드' };

export default async function AgentDashboardPage() {
  const user = await requireAgent(AGENT_ROUTES.dashboard);
  return <DashboardView user={user} />;
}
