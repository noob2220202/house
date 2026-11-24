import { ROUTES } from '@/config/nav';
import { dealRequestPageSchema } from '@/features/w-deal/api/schemas';
import {
  NewRequestActions,
  parseStatusFilter,
  parseTypeFilter,
  RequestsListView,
  STATUS_PARAM,
  TYPE_PARAM,
} from '@/features/w-deal/components/requests/RequestsListView';
import { MePage } from '@/features/w-me/components/MePage';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '내놓기·구하기 요청',
  description: '내가 보낸 내놓기·구하기 요청과 중개사무소가 보낸 제안을 확인하세요.',
  path: ROUTES.myRequests,
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /me/requests — 내 요청 관리: my 내놓기 / 구하기 requests with proposal counts. */
export default async function MyRequestsPage({ searchParams }: { searchParams: Search }) {
  await requireUser(ROUTES.myRequests);
  const sp = await searchParams;
  const type = parseTypeFilter(one(sp.type));
  const status = parseStatusFilter(one(sp.status));
  const page = Math.max(1, Number(one(sp.page)) || 1);

  let data = null;
  let errorCode: string | undefined;
  try {
    data = await serverGetAuthed('/me/deal-requests', {
      query: {
        type: type === 'all' ? undefined : TYPE_PARAM[type],
        status: status === 'all' ? undefined : STATUS_PARAM[status],
        page,
        pageSize: 10,
      },
      schema: dealRequestPageSchema,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    errorCode = error.requestId ?? error.code;
  }

  return (
    <MePage
      title="내놓기·구하기 요청"
      mobileTitle="내 요청"
      description="보낸 요청과 중개사무소가 보낸 제안을 한곳에서 확인하고 비교하세요."
      backHref={ROUTES.me}
      actions={<NewRequestActions />}
    >
      <RequestsListView
        type={type}
        status={status}
        data={data}
        errorCode={errorCode}
        now={new Date().toISOString()}
      />
    </MePage>
  );
}
