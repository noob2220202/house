import { MePage } from '@/features/w-me/components/MePage';
import { ME_ROUTES } from '@/features/w-me/routes';
import { requireMe } from '@/features/w-me/server';
import { MY_INQUIRIES_PAGE_SIZE } from '@/features/w-inquiry/api';
import { MyInquiriesView } from '@/features/w-inquiry/me/MyInquiriesView';
import { myInquiryPageSchema, type MyInquiryPage } from '@/features/w-inquiry/schemas';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '문의 내역',
  description: '중개사무소에 남긴 문의와 받은 답변을 확인하세요.',
  path: ME_ROUTES.inquiries,
  noindex: true,
});

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /me/inquiries — MY > 문의 내역: written inquiries to offices and their answers. */
export default async function MyInquiriesPage({ searchParams }: { searchParams: Search }) {
  await requireMe(ME_ROUTES.inquiries);
  const sp = await searchParams;
  const page = Math.min(9999, Math.max(1, Number.parseInt(one(sp.page) ?? '', 10) || 1));
  let initial: MyInquiryPage | null = null;
  try {
    initial = await serverGetAuthed('/me/inquiries', {
      query: { page, pageSize: MY_INQUIRIES_PAGE_SIZE },
      schema: myInquiryPageSchema,
    });
  } catch (error) {
    // The view shows its own retry state and asks again from the browser.
    if (!(error instanceof ApiError)) throw error;
  }
  return (
    <MePage
      title="문의 내역"
      description="중개사무소에 남긴 문의와 답변을 한곳에서 확인하세요. 답변이 오면 알림으로 알려 드려요."
      backHref={ME_ROUTES.overview}
    >
      <MyInquiriesView page={page} initial={initial} />
    </MePage>
  );
}
