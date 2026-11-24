import type { Metadata } from 'next';
import { ApplyView } from '@/features/a-agency/apply/ApplyView';
import { requireUser } from '@/lib/auth/server';

export const metadata: Metadata = { title: '중개사 회원 신청' };

/** Any signed-in user may open this page (application / invite-code join / status tracking). */
export default async function AgentApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  await requireUser(tab === 'join' ? '/agent/apply?tab=join' : '/agent/apply');
  return <ApplyView tab={tab === 'join' ? 'join' : 'register'} />;
}
