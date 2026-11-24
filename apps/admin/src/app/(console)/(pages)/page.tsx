import type { Metadata } from 'next';
import { DashboardView } from '@/features/m-core/components/dashboard/DashboardView';

export const metadata: Metadata = { title: '대시보드' };

/**
 * Back-office home (AdminDashboard design): KPIs, visitor trend (7 / 30 days), pending agencies,
 * recent 내놓기·구하기 requests, reported listings and ads about to expire.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string | string[] }>;
}) {
  const { denied } = await searchParams;
  return <DashboardView denied={denied !== undefined} />;
}
