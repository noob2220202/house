import { ROUTES } from '@/config/nav';
import { SellWizard } from '@/features/w-deal/components/sell/SellWizard';
import { toWizardUser } from '@/features/w-deal/lib/wizard-user';
import { requireUser } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '내 집 내놓기',
  description: '매물 정보를 한 번만 등록하면 근처 공인중개사무소에 함께 전달돼요.',
  path: ROUTES.dealSell,
  noindex: true,
});

/** /deal/sell — 내놓기 wizard (login required; the draft is autosaved in localStorage). */
export default async function DealSellPage() {
  const user = await requireUser(ROUTES.dealSell);
  return <SellWizard user={toWizardUser(user)} />;
}
