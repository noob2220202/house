import type { Metadata } from 'next';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { SiteView } from '@/features/a-agency/site/SiteView';
import { requireAgent } from '@/lib/auth/server';

export const metadata: Metadata = { title: '내 홈페이지' };

/**
 * /agent/site — 내 홈페이지 (the office's own site at `<slug>.suncheonmap.kr`, SPEC §4.4): request
 * an address, then the brand colour and 한 줄 소개. Owner writes, staff read.
 */
export default async function AgentSitePage() {
  await requireAgent(AGENT_ROUTES.site);
  return <SiteView />;
}
