import { redirect } from 'next/navigation';
import { AGENT_ROUTES } from '@/features/a-agency/nav';

/**
 * /agent/inquiries — the 문의함 is hidden for launch (DECISIONS D5: no inquiry backend; the public
 * "문의하기" stays the phone / SMS contact dialog). Old links and bookmarks land on the dashboard.
 */
export default function AgentInquiriesPage(): never {
  redirect(AGENT_ROUTES.dashboard);
}
