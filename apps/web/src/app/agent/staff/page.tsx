import { UserRole } from '@house/shared';
import type { Metadata } from 'next';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { StaffView } from '@/features/a-agency/staff/StaffView';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '직원 관리' };

/** Owner only: 소속 중개사 (AGENT) get an explanation instead of the list (the API returns 403). */
export default async function AgentStaffPage() {
  const user = await requireAgent(AGENT_ROUTES.staff);
  return <StaffView isOwner={user.role === UserRole.AGENCY_OWNER} />;
}
