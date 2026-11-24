import { ROUTES } from '@/config/nav';
import { CompletePage } from '@/features/w-deal/components/complete/CompletePage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '구하기 요청 완료',
  path: `${ROUTES.dealFind}/complete`,
  noindex: true,
});

/** /deal/find/complete?id=… — confirmation after a 구하기 request is created. */
export default async function DealFindCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  return <CompletePage kind="find" id={Array.isArray(id) ? id[0] : id} />;
}
