import { ROUTES } from '@/config/nav';
import { FindWizard } from '@/features/w-deal/components/find/FindWizard';
import { toWizardUser } from '@/features/w-deal/lib/wizard-user';
import { requireUser } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '원하는 집 구하기',
  description: '원하는 조건을 등록하면 지역 공인중개사무소가 맞춤 매물을 제안해요.',
  path: ROUTES.dealFind,
  noindex: true,
});

/** /deal/find — 구하기 wizard (login required; the draft is autosaved in localStorage). */
export default async function DealFindPage() {
  const user = await requireUser(ROUTES.dealFind);
  return <FindWizard user={toWizardUser(user)} />;
}
