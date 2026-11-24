import { ROUTES } from '@/config/nav';
import { CompletePage } from '@/features/w-deal/components/complete/CompletePage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '내놓기 요청 완료',
  path: `${ROUTES.dealSell}/complete`,
  noindex: true,
});

/** /deal/sell/complete?id=… — confirmation after a 내놓기 request is created. */
export default async function DealSellCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  return <CompletePage kind="sell" id={Array.isArray(id) ? id[0] : id} />;
}
