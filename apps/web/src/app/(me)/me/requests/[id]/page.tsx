import { DealRequestType } from '@house/shared';
import { notFound } from 'next/navigation';
import { ROUTES } from '@/config/nav';
import { dealRequestDetailSchema } from '@/features/w-deal/api/schemas';
import { RequestDetailView } from '@/features/w-deal/components/requests/RequestDetailView';
import { MePage } from '@/features/w-me/components/MePage';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '요청 상세',
  path: ROUTES.myRequests,
  noindex: true,
});

/** /me/requests/[id] — one request with the proposals it received. */
export default async function MyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`${ROUTES.myRequests}/${id}`);
  let request;
  try {
    request = await serverGetAuthed(`/me/deal-requests/${encodeURIComponent(id)}`, {
      schema: dealRequestDetailSchema,
    });
  } catch (error) {
    // Someone else's request answers 404 as well (the API never confirms it exists).
    if (error instanceof ApiError && (error.isNotFound || error.isValidation)) notFound();
    throw error;
  }
  const sell = request.type === DealRequestType.SELL_OR_LEASE;
  return (
    <MePage
      title={sell ? '내놓기 요청' : '구하기 요청'}
      description="받은 제안을 비교하고, 마음에 드는 중개사무소에만 연락처를 공개하세요."
      backHref={ROUTES.myRequests}
    >
      <RequestDetailView initial={request} now={new Date().toISOString()} />
    </MePage>
  );
}
